# frozen_string_literal: true

class JobStatusPollerService
  # Polls DynamoDB for job status records written by the pipeline runner.
  #
  # The runner writes status to:
  #   PK: PROVIDER#{cloud_provider}#ACCOUNT#{account_id}
  #   SK: VERSION#{version}#LAYER#{layer_index}#JOB
  #
  # This service reads those records and syncs them back into the
  # DeploymentLayer / Deployment ActiveRecord models, replacing the
  # need for HTTP callbacks from the runner.

  # Maps runner statuses to layer statuses
  RUNNER_TO_LAYER_STATUS = {
    "received" => "dispatched",
    "executing" => "executing",
    "completed" => "completed",
    "failed" => "failed",
    "interrupted" => "failed"
  }.freeze

  def initialize(deployment)
    @deployment = deployment
    @environment = deployment.local_environment
    @table_name = ENV["DYNAMODB_STATE_TABLE"]
  end

  # Polls DynamoDB for all layers in this deployment and syncs status.
  # Returns true if any layer status changed.
  def sync!
    return false unless @table_name

    changed = false

    @deployment.deployment_layers.ordered.each do |layer|
      dynamo_status = fetch_layer_status(layer)
      next unless dynamo_status

      new_layer_status = RUNNER_TO_LAYER_STATUS[dynamo_status[:status]]
      next unless new_layer_status
      next if terminal?(layer.status) # Don't overwrite terminal states
      next if layer.status == new_layer_status # No change

      attrs = { status: new_layer_status }
      attrs[:error_details] = dynamo_status[:error_details] if dynamo_status[:error_details].present?
      attrs[:completed_at] = Time.current if %w[completed failed].include?(new_layer_status)
      attrs[:step_details] = dynamo_status[:steps] if dynamo_status[:steps].present?

      layer.update!(attrs)
      changed = true

      # Drive the deployment state machine forward
      handle_layer_transition(layer, new_layer_status)
    end

    changed
  end

  private

  def fetch_layer_status(layer)
    # Build the DynamoDB key matching what the runner writes
    cloud_provider = @environment.cloud_provider
    account_id = @environment.aws_account_id || @environment.azure_subscription_id || @environment.gcp_project_id
    version = @deployment.version.to_s.rjust(6, "0")

    pk = "PROVIDER##{cloud_provider}#ACCOUNT##{account_id}"
    sk = "VERSION##{version}#LAYER##{layer.index}#JOB"

    resp = dynamodb_client.get_item(
      table_name: @table_name,
      key: { "PK" => pk, "SK" => sk }
    )

    return nil unless resp.item

    # Also fetch step-level records for this layer
    steps = fetch_step_records(pk, @deployment.version, layer.index)

    {
      status: resp.item["status"],
      error_details: resp.item["error_details"],
      started_at: resp.item["started_at"],
      completed_at: resp.item["completed_at"],
      updated_at: resp.item["updated_at"],
      steps: steps
    }
  rescue Aws::DynamoDB::Errors::ServiceError => e
    Rails.logger.error("JobStatusPollerService: DynamoDB error for layer #{layer.index}: #{e.message}")
    nil
  end

  def fetch_step_records(pk, version, layer_index)
    padded_version = version.to_s.rjust(6, "0")
    sk_prefix = "VERSION##{padded_version}#LAYER##{layer_index}#STEP#"

    resp = dynamodb_client.query(
      table_name: @table_name,
      key_condition_expression: "PK = :pk AND begins_with(SK, :sk_prefix)",
      expression_attribute_values: {
        ":pk" => pk,
        ":sk_prefix" => sk_prefix
      }
    )

    (resp.items || []).map do |item|
      step_name = item["SK"].to_s.split("STEP#").last
      {
        name: step_name,
        status: item["status"],
        duration: item["duration"]&.to_f
      }
    end
  rescue Aws::DynamoDB::Errors::ServiceError => e
    Rails.logger.error("JobStatusPollerService: DynamoDB error fetching steps: #{e.message}")
    []
  end

  def handle_layer_transition(layer, new_status)
    case new_status
    when "completed"
      # Check if there's a next layer to advance to, or finalize
      next_layer = @deployment.deployment_layers
                              .where("index > ?", layer.index)
                              .ordered.first

      if next_layer
        @deployment.update!(current_layer: next_layer.index)
      else
        finalize_deployment
      end
    when "failed"
      # Skip subsequent layers and mark deployment as failed
      @deployment.deployment_layers
                 .where("index > ?", layer.index)
                 .update_all(status: "skipped")

      @deployment.update!(
        status: "failed",
        completed_at: Time.current,
        result: (@deployment.result || {}).merge(
          "error" => "Layer #{layer.index} failed: #{layer.error_details}"
        )
      )
    end
  end

  def finalize_deployment
    action = @deployment.status == "applying" ? "deploy" : "plan"

    if action == "plan"
      # Fetch infracost data from S3 for each layer
      fetch_layer_costs

      cost_estimate = CostAggregator.aggregate(@deployment.reload)
      @deployment.update!(
        status: "planned",
        approval_status: "pending_approval",
        cost_estimate: cost_estimate,
        completed_at: Time.current
      )
    else
      @deployment.update!(
        status: "completed",
        completed_at: Time.current
      )
    end
  end

  def fetch_layer_costs
    bucket = ENV["TFENGINE_S3_ARTIFACTS_BUCKET_NAME"]
    return unless bucket

    cloud_provider = @environment.cloud_provider
    account_id = @environment.aws_account_id || @environment.azure_subscription_id || @environment.gcp_project_id
    version = @deployment.version.to_s.rjust(6, "0")

    @deployment.deployment_layers.ordered.each do |layer|
      key = "#{cloud_provider}/#{account_id}/#{version}/layer_#{layer.index}/infracost/infracost.json"
      begin
        resp = s3_client.get_object(bucket: bucket, key: key)
        json = JSON.parse(resp.body.read)
        layer.update!(cost_estimate: json)
      rescue Aws::S3::Errors::NoSuchKey
        Rails.logger.info("No infracost data for layer #{layer.index}")
      rescue Aws::S3::Errors::ServiceError => e
        Rails.logger.warn("Failed to fetch infracost for layer #{layer.index}: #{e.message}")
      rescue JSON::ParserError => e
        Rails.logger.warn("Invalid infracost JSON for layer #{layer.index}: #{e.message}")
      end
    end
  end

  def s3_client
    @s3_client ||= Aws::S3::Client.new
  end

  def terminal?(status)
    %w[completed failed skipped].include?(status)
  end

  def dynamodb_client
    @dynamodb_client ||= Aws::DynamoDB::Client.new(
      **(Rails.env.development? ? { ssl_verify_peer: false } : {})
    )
  end
end
