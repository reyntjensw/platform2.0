# frozen_string_literal: true

class EnvironmentCredentialsService
  # Fetches deployment credentials (role ARN, external ID) from the
  # platform's environment_info record via the backend API.
  #
  # Primary path: PlatformApiClient → GET /environment_info/:customer/:project?aws_account_id=...
  # Fallback:     Direct DynamoDB query via aws_account_id_index GSI
  #
  # The API approach works in all environments (dev/staging/prod) without
  # requiring direct DynamoDB access from the Rails app.

  TABLE_NAME = "environment_info"

  class CredentialNotFoundError < StandardError; end

  # @param customer_uuid [String]
  # @param project_uuid [String]
  # @param aws_account_id [String]
  # @return [Hash] { role_arn:, external_id: }
  def self.fetch_aws(customer_uuid:, project_uuid:, aws_account_id:)
    new.fetch_aws(customer_uuid: customer_uuid, project_uuid: project_uuid, aws_account_id: aws_account_id)
  end

  def fetch_aws(customer_uuid:, project_uuid:, aws_account_id:)
    # Primary: query via the backend API (works everywhere, no direct DynamoDB needed)
    info = query_via_api(customer_uuid, project_uuid, aws_account_id)
    return info if info

    # Fallback: direct DynamoDB query via GSI (for environments without the API)
    info = query_dynamodb_gsi(aws_account_id)
    return info if info

    raise CredentialNotFoundError,
          "No credentials found for AWS account #{aws_account_id} " \
          "(customer=#{customer_uuid}, project=#{project_uuid})"
  end

  private

  def query_via_api(customer_uuid, project_uuid, aws_account_id)
    client = PlatformApiClient.new
    response = client.get_env_info(
      customer_uuid: customer_uuid,
      project_uuid: project_uuid,
      aws_account_id: aws_account_id
    )

    unless response.success?
      Rails.logger.warn("EnvironmentCredentialsService: API returned #{response.status} for #{customer_uuid}/#{project_uuid}")
      return nil
    end

    data = response.data
    role_arn = data[:admin_role_arn] || data["admin_role_arn"]
    external_id = data[:external_id] || data["external_id"]

    if role_arn.blank?
      raise CredentialNotFoundError, "admin_role_arn missing for account #{aws_account_id}"
    end
    if external_id.blank?
      raise CredentialNotFoundError, "external_id missing for account #{aws_account_id}"
    end

    { role_arn: role_arn, external_id: external_id }
  rescue Faraday::Error => e
    Rails.logger.error("EnvironmentCredentialsService: API error: #{e.message}")
    nil
  end

  def query_dynamodb_gsi(aws_account_id)
    resp = dynamodb_client.query(
      table_name: TABLE_NAME,
      index_name: "aws_account_id_index",
      key_condition_expression: "aws_account_id = :aid",
      expression_attribute_values: { ":aid" => aws_account_id },
      projection_expression: "external_id, admin_role_arn"
    )

    return nil if resp.items.empty?

    item = resp.items.first
    role_arn = item["admin_role_arn"]
    external_id = item["external_id"]

    return nil if role_arn.blank? || external_id.blank?

    { role_arn: role_arn, external_id: external_id }
  rescue Aws::DynamoDB::Errors::ServiceError => e
    Rails.logger.warn("EnvironmentCredentialsService: DynamoDB fallback failed: #{e.message}")
    nil
  end

  def dynamodb_client
    @dynamodb_client ||= Aws::DynamoDB::Client.new(
      **(Rails.env.development? ? { ssl_verify_peer: false } : {})
    )
  end
end
