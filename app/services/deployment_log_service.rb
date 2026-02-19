# frozen_string_literal: true

class DeploymentLogService
  # Fetches step execution logs from S3 for a given deployment layer.
  # The runner writes logs to:
  #   s3://{bucket}/{provider}/{account}/{version}/layer_{index}/{step_name}/out.log

  def initialize(deployment, layer)
    @deployment = deployment
    @layer = layer
    @environment = deployment.local_environment
    @bucket = ENV["TFENGINE_S3_ARTIFACTS_BUCKET_NAME"] || ENV["S3_ARTIFACTS_BUCKET"]
  end

  # Returns a hash of { step_name => log_content } for all steps in this layer.
  def fetch_logs
    return {} unless @bucket

    cloud_provider = @environment.cloud_provider
    account_id = @environment.aws_account_id || @environment.azure_subscription_id || @environment.gcp_project_id
    version = @deployment.version.to_s.rjust(6, "0")
    prefix = "#{cloud_provider}/#{account_id}/#{version}/layer_#{@layer.index}/"

    logs = {}
    begin
      resp = s3_client.list_objects_v2(bucket: @bucket, prefix: prefix)
      (resp.contents || []).each do |obj|
        next unless obj.key.end_with?("/out.log")

        # Extract step name from path: .../layer_0/step_name/out.log
        step_name = obj.key.split("/")[-2]
        body = s3_client.get_object(bucket: @bucket, key: obj.key).body.read
        logs[step_name] = body.force_encoding("UTF-8")
      end
    rescue Aws::S3::Errors::ServiceError => e
      Rails.logger.error("DeploymentLogService: S3 error: #{e.message}")
    end

    logs
  end

  # Returns the log for a single step, or nil if not found.
  def fetch_step_log(step_name)
    return nil unless @bucket

    cloud_provider = @environment.cloud_provider
    account_id = @environment.aws_account_id || @environment.azure_subscription_id || @environment.gcp_project_id
    version = @deployment.version.to_s.rjust(6, "0")
    key = "#{cloud_provider}/#{account_id}/#{version}/layer_#{@layer.index}/#{step_name}/out.log"

    s3_client.get_object(bucket: @bucket, key: key).body.read.force_encoding("UTF-8")
  rescue Aws::S3::Errors::NoSuchKey
    nil
  rescue Aws::S3::Errors::ServiceError => e
    Rails.logger.error("DeploymentLogService: S3 error for #{step_name}: #{e.message}")
    nil
  end

  # Returns the human-readable plan output (plan.txt) from S3, or nil.
  def fetch_plan
    return nil unless @bucket

    cloud_provider = @environment.cloud_provider
    account_id = @environment.aws_account_id || @environment.azure_subscription_id || @environment.gcp_project_id
    version = @deployment.version.to_s.rjust(6, "0")
    key = "#{cloud_provider}/#{account_id}/#{version}/layer_#{@layer.index}/tofu_plan/plan.txt"

    s3_client.get_object(bucket: @bucket, key: key).body.read.force_encoding("UTF-8")
  rescue Aws::S3::Errors::NoSuchKey
    nil
  rescue Aws::S3::Errors::ServiceError => e
    Rails.logger.error("DeploymentLogService: S3 error fetching plan: #{e.message}")
    nil
  end

  # Returns parsed infracost JSON data from S3, or nil.
  def fetch_infracost
    return nil unless @bucket

    cloud_provider = @environment.cloud_provider
    account_id = @environment.aws_account_id || @environment.azure_subscription_id || @environment.gcp_project_id
    version = @deployment.version.to_s.rjust(6, "0")
    key = "#{cloud_provider}/#{account_id}/#{version}/layer_#{@layer.index}/infracost/infracost.json"

    body = s3_client.get_object(bucket: @bucket, key: key).body.read
    JSON.parse(body)
  rescue Aws::S3::Errors::NoSuchKey
    nil
  rescue Aws::S3::Errors::ServiceError => e
    Rails.logger.error("DeploymentLogService: S3 error fetching infracost: #{e.message}")
    nil
  rescue JSON::ParserError => e
    Rails.logger.error("DeploymentLogService: Invalid infracost JSON: #{e.message}")
    nil
  end

  private

  def s3_client
    @s3_client ||= Aws::S3::Client.new(
      **(Rails.env.development? ? { ssl_verify_peer: false } : {})
    )
  end
end
