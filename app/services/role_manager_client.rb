# frozen_string_literal: true

class RoleManagerClient < ApiClient::Base
  def initialize
    @conn = self.class.connection(
      ENV.fetch("ROLE_MANAGER_URL"),
      headers: platform_auth_headers
    )
  end

  def validate_account(account_id:, external_id:, role_name:)
    post("/accounts/validate", {
      account_id: account_id,
      external_id: external_id,
      role_name: role_name
    })
  end

  def register_account(customer_uuid:, project_uuid:, aws_account_id:, external_id:, role_name:, role_types:, sla:)
    post("/accounts/register", {
      customer_uuid: customer_uuid,
      project_uuid: project_uuid,
      aws_account_id: aws_account_id,
      external_id: external_id,
      role_name: role_name,
      role_types: role_types,
      sla: sla
    })
  end

  private

  attr_reader :conn

  def platform_auth_headers
    key = ENV.fetch("CS_PLATFORM_API_KEY", "")
    { "cs-intelligent-platform-header" => key }
  end
end
