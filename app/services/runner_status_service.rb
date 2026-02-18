# frozen_string_literal: true

class RunnerStatusService
  # Queries DynamoDB for runner registration records.
  # Runner records use PK=RUNNER#{account_id}, SK=RUNNER#{runner_id}.

  RUNNER_PK_PREFIX = "RUNNER#"
  STALE_THRESHOLD = 90 # seconds — 3x the default 30s heartbeat interval

  def initialize(account_id: nil)
    @account_id = account_id
    @table_name = ENV["DYNAMODB_STATE_TABLE"]
  end

  # Returns an array of runner hashes for the given account,
  # or all runners if no account_id was provided.
  def list_runners
    return [] unless @table_name

    runners = if @account_id
                query_runners_for_account(@account_id)
              else
                scan_all_runners
              end

    # Enrich with computed liveness based on heartbeat freshness
    cutoff = Time.current - STALE_THRESHOLD
    runners.each do |r|
      if r[:last_heartbeat]
        last_hb = Time.parse(r[:last_heartbeat])
        r[:live] = last_hb > cutoff
      else
        r[:live] = false
      end
    end

    runners
  rescue Aws::DynamoDB::Errors::ServiceError => e
    Rails.logger.error("RunnerStatusService: DynamoDB error: #{e.message}")
    []
  end

  # Returns true if at least one runner has a fresh heartbeat.
  def any_active?
    list_runners.any? { |r| r[:live] && r[:status] == "active" }
  end

  # Marks runners with stale heartbeats as offline and deletes
  # runners that have been offline for longer than max_offline_age.
  def cleanup_stale_runners(max_offline_age: 1.hour)
    return unless @table_name

    cutoff = Time.current - STALE_THRESHOLD
    delete_cutoff = Time.current - max_offline_age

    runners = @account_id ? query_runners_for_account(@account_id) : scan_all_runners

    runners.each do |runner|
      last_hb = runner[:last_heartbeat] ? Time.parse(runner[:last_heartbeat]) : nil
      pk = "#{RUNNER_PK_PREFIX}#{runner[:account_id]}"
      sk = "#{RUNNER_PK_PREFIX}#{runner[:runner_id]}"

      if runner[:status] == "offline" && last_hb && last_hb < delete_cutoff
        # Delete long-offline runners
        dynamodb_client.delete_item(table_name: @table_name, key: { "PK" => pk, "SK" => sk })
        Rails.logger.info("RunnerStatusService: Deleted stale runner #{runner[:runner_id]}")
      elsif runner[:status] == "active" && (last_hb.nil? || last_hb < cutoff)
        # Mark as offline
        dynamodb_client.update_item(
          table_name: @table_name,
          key: { "PK" => pk, "SK" => sk },
          update_expression: "SET #status = :s",
          expression_attribute_names: { "#status" => "status" },
          expression_attribute_values: { ":s" => "offline" }
        )
        Rails.logger.info("RunnerStatusService: Marked runner #{runner[:runner_id]} as offline (stale heartbeat)")
      end
    end
  rescue Aws::DynamoDB::Errors::ServiceError => e
    Rails.logger.error("RunnerStatusService: Cleanup error: #{e.message}")
  end

  # Fetches the current runner version manifest from S3.
  def fetch_manifest
    bucket = ENV["S3_ARTIFACTS_BUCKET"]
    return nil unless bucket

    resp = s3_client.get_object(bucket: bucket, key: "runner/manifest.json")
    JSON.parse(resp.body.read)
  rescue Aws::S3::Errors::ServiceError, JSON::ParserError => e
    Rails.logger.error("RunnerStatusService: Failed to fetch manifest: #{e.message}")
    nil
  end

  private

  def query_runners_for_account(account_id)
    resp = dynamodb_client.query(
      table_name: @table_name,
      key_condition_expression: "PK = :pk AND begins_with(SK, :sk_prefix)",
      expression_attribute_values: {
        ":pk" => "#{RUNNER_PK_PREFIX}#{account_id}",
        ":sk_prefix" => RUNNER_PK_PREFIX
      }
    )
    resp.items.map { |item| normalize_runner(item) }
  end

  def scan_all_runners
    resp = dynamodb_client.scan(
      table_name: @table_name,
      filter_expression: "begins_with(PK, :prefix) AND begins_with(SK, :sk_prefix)",
      expression_attribute_values: {
        ":prefix" => RUNNER_PK_PREFIX,
        ":sk_prefix" => RUNNER_PK_PREFIX
      }
    )
    resp.items.map { |item| normalize_runner(item) }
  end

  def normalize_runner(item)
    {
      runner_id: item["runner_id"],
      account_id: item["account_id"],
      runner_mode: item["runner_mode"],
      execution_mode: item["execution_mode"],
      version: item["version"],
      status: item["status"],
      last_heartbeat: item["last_heartbeat"],
      registered_at: item["registered_at"]
    }
  end

  def dynamodb_client
    @dynamodb_client ||= Aws::DynamoDB::Client.new(
      **ssl_options
    )
  end

  def s3_client
    @s3_client ||= Aws::S3::Client.new(
      **ssl_options
    )
  end

  def ssl_options
    return {} unless Rails.env.development?

    { ssl_verify_peer: false }
  end
end
