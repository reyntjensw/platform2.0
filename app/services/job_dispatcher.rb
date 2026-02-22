# frozen_string_literal: true

class JobDispatcher
  class DispatchError < StandardError; end

  # Single central FIFO queue for all pipeline jobs — set per environment (dev/acc/prod)
  def self.queue_url
    ENV.fetch("SQS_PIPELINE_QUEUE_URL")
  end

  def initialize
    @sqs = Aws::SQS::Client.new(
      **(Rails.env.development? ? { ssl_verify_peer: false } : {})
    )
  end

  # Dispatches a plan job for a single deployment layer.
  #
  # @param deployment [Deployment]
  # @param layer [DeploymentLayer]
  # @param ir_payload [Hash] IR payload from IRBuilder.build_for_layer
  # @return [String] job_id
  def dispatch_plan(deployment, layer, ir_payload)
    body = build_job_body(deployment, layer, ir_payload)
    clear_dynamo_status(body, layer)
    publish_job(
      job_id: SecureRandom.uuid,
      action: "plan",
      deployment_id: deployment.id,
      execution_mode: deployment.local_environment.execution_mode,
      **body
    )
  end

  # Dispatches a deploy (apply) job for a single deployment layer.
  #
  # @param deployment [Deployment]
  # @param layer [DeploymentLayer]
  # @param ir_payload [Hash] IR payload from IRBuilder.build_for_layer
  # @return [String] job_id
  def dispatch_deploy(deployment, layer, ir_payload)
    body = build_job_body(deployment, layer, ir_payload)
    clear_dynamo_status(body, layer)
    publish_job(
      job_id: SecureRandom.uuid,
      action: "deploy",
      deployment_id: deployment.id,
      execution_mode: deployment.local_environment.execution_mode,
      **body
    )
  end

  private

  def publish_job(job_body)
    account_id = job_body[:account_id].to_s
    execution_mode = job_body[:execution_mode] || "platform"

    @sqs.send_message(
      queue_url: self.class.queue_url,
      message_body: job_body.to_json,
      message_group_id: account_id,
      message_deduplication_id: job_body[:job_id],
      message_attributes: {
        "account_id" => { string_value: account_id, data_type: "String" },
        "execution_mode" => { string_value: execution_mode, data_type: "String" }
      }
    )

    job_body[:job_id]
  rescue Aws::SQS::Errors::ServiceError => e
    raise DispatchError, "Failed to publish job to SQS: #{e.message}"
  end

  def clear_dynamo_status(body, layer)
    table_name = ENV["DYNAMODB_STATE_TABLE"]
    return unless table_name

    pk = "PROVIDER##{body[:cloud_provider]}#ACCOUNT##{body[:account_id]}"
    version = body[:version].to_s.rjust(6, "0")
    sk_job = "VERSION##{version}#LAYER##{layer.index}#JOB"

    dynamodb = Aws::DynamoDB::Client.new(
      **(Rails.env.development? ? { ssl_verify_peer: false } : {})
    )

    # Delete the job-level record
    dynamodb.delete_item(table_name: table_name, key: { "PK" => pk, "SK" => sk_job })

    # Delete step-level records
    sk_prefix = "VERSION##{version}#LAYER##{layer.index}#STEP#"
    resp = dynamodb.query(
      table_name: table_name,
      key_condition_expression: "PK = :pk AND begins_with(SK, :prefix)",
      expression_attribute_values: { ":pk" => pk, ":prefix" => sk_prefix },
      projection_expression: "PK, SK"
    )
    resp.items&.each do |item|
      dynamodb.delete_item(table_name: table_name, key: { "PK" => item["PK"], "SK" => item["SK"] })
    end
  rescue Aws::DynamoDB::Errors::ServiceError => e
    Rails.logger.warn("JobDispatcher: failed to clear old DynamoDB status: #{e.message}")
  end

  def build_job_body(deployment, layer, ir_payload)
    env_block = ir_payload[:environment]
    creds = ir_payload[:credentials]
    account_id = creds[:aws_account_id] || creds[:azure_subscription_id] || creds[:gcp_project_id]

    if account_id.blank?
      raise DispatchError, "Cannot dispatch job: environment has no cloud account ID configured (aws_account_id / azure_subscription_id / gcp_project_id)"
    end

    version = ir_payload[:backend][:version] || "000001"

    {
      iac_engine: env_block[:iac_engine] || "opentofu",
      layer_index: layer.index,
      total_layers: deployment.total_layers || 1,
      cloud_provider: env_block[:cloud_provider],
      region: env_block[:region],
      account_id: account_id.to_s,
      version: version,
      credentials: creds,
      backend_config: ir_payload[:backend],
      modules: ir_payload[:modules],
      layer_context: ir_payload[:layer_context],
      git_credentials: ir_payload[:git_credentials],
      tags: ir_payload[:tags],
      artifact_prefix: "#{env_block[:cloud_provider]}/#{account_id}/#{version}",
      callback_url: ir_payload[:callback_url]
    }
  end
end
