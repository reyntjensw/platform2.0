# frozen_string_literal: true

class StaleHeartbeatDetectionJob < ApplicationJob
  queue_as :default

  # Default heartbeat interval is 30 seconds; stale threshold is 3x that.
  HEARTBEAT_INTERVAL = ENV.fetch("HEARTBEAT_INTERVAL", "30").to_i
  STALE_THRESHOLD_MULTIPLIER = 3

  # Checks all active (dispatched/executing) deployment layers for stale
  # runner heartbeats. If a layer's runner hasn't sent a heartbeat within
  # 3x the heartbeat interval, the layer is marked as failed and subsequent
  # layers are skipped.
  def perform
    stale_cutoff = Time.current - (HEARTBEAT_INTERVAL * STALE_THRESHOLD_MULTIPLIER)

    active_layers = DeploymentLayer
      .where(status: %w[dispatched executing])
      .where.not(job_id: nil)
      .includes(deployment: :local_environment)

    return if active_layers.empty?

    active_layers.find_each do |layer|
      check_layer_heartbeat(layer, stale_cutoff)
    rescue => e
      Rails.logger.error(
        "StaleHeartbeatDetectionJob: Error checking layer #{layer.id}: #{e.message}"
      )
    end
  end

  private

  def check_layer_heartbeat(layer, stale_cutoff)
    deployment = layer.deployment
    last_heartbeat_str = fetch_last_heartbeat(layer, deployment)

    # If no DynamoDB record exists yet, check if the layer has been waiting
    # too long since it was dispatched (started_at).
    if last_heartbeat_str.nil?
      return unless layer.started_at && layer.started_at < stale_cutoff
    else
      last_heartbeat = Time.parse(last_heartbeat_str)
      return unless last_heartbeat < stale_cutoff
    end

    Rails.logger.warn(
      "StaleHeartbeatDetectionJob: Layer #{layer.id} (deployment #{deployment.id}) " \
      "has stale heartbeat. Marking as failed."
    )

    layer.update!(
      status: "failed",
      error_details: "Runner heartbeat stale (last: #{last_heartbeat_str || 'never'}). Job presumed dead.",
      completed_at: Time.current
    )

    DeployService.new(deployment.local_environment, nil)
                 .on_layer_failed(deployment, layer)
  end

  def fetch_last_heartbeat(layer, deployment)
    table_name = ENV["DYNAMODB_STATE_TABLE"]
    return nil unless table_name

    env = deployment.local_environment
    provider = env.cloud_provider
    account_id = env.aws_account_id || env.azure_subscription_id || env.gcp_project_id
    # Version defaults to "000001" matching the runner's default
    version = "000001"

    pk = "PROVIDER##{provider}#ACCOUNT##{account_id}"
    sk = "VERSION##{version}#LAYER##{layer.index}#JOB"

    resp = dynamodb_client.get_item(
      table_name: table_name,
      key: { "PK" => pk, "SK" => sk },
      projection_expression: "last_heartbeat"
    )

    resp.item&.dig("last_heartbeat")
  rescue Aws::DynamoDB::Errors::ServiceError => e
    Rails.logger.error("StaleHeartbeatDetectionJob: DynamoDB error: #{e.message}")
    nil
  end

  def dynamodb_client
    @dynamodb_client ||= Aws::DynamoDB::Client.new(
      **(Rails.env.development? ? { ssl_verify_peer: false } : {})
    )
  end
end
