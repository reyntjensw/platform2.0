# frozen_string_literal: true

class PlatformApiClient < ApiClient::Base
  def initialize
    @conn = self.class.connection(
      ENV.fetch("PLATFORM_API_URL", "http://localhost:8000"),
      headers: platform_auth_headers
    )
  end

  # ---------------------------------------------------------------------------
  # Azure Credentials
  # ---------------------------------------------------------------------------

  def test_azure(tenant_id:, client_id:, client_secret:, subscription_id: nil)
    post("/azure/credentials/test", {
      tenant_id: tenant_id,
      client_id: client_id,
      client_secret: client_secret,
      subscription_id: subscription_id
    }.compact)
  end

  def save_azure(customer_uuid:, **attrs)
    post("/azure/credentials/save", { customer_uuid: customer_uuid, **attrs })
  end

  def list_azure(customer_uuid:, tenant_id: nil)
    post("/azure/credentials/list", { customer_uuid: customer_uuid, tenant_id: tenant_id }.compact)
  end

  def delete_azure(customer_uuid:, credential_id:)
    post("/azure/credentials/delete", { customer_uuid: customer_uuid, credential_id: credential_id })
  end

  def update_azure(customer_uuid:, credential_id:, **attrs)
    post("/azure/credentials/update", { customer_uuid: customer_uuid, credential_id: credential_id, **attrs })
  end

  def expiring_azure(customer_uuid:)
    post("/azure/credentials/expiring", { customer_uuid: customer_uuid })
  end

  def get_azure_with_secret(customer_uuid:, tenant_id:, credential_id:)
    post("/azure/credentials/test-stored", {
      customer_uuid: customer_uuid,
      tenant_id: tenant_id,
      credential_id: credential_id
    })
  end

  def link_subscription(customer_uuid:, project_uuid:, subscription_id:, tenant_id:,
                        admin_credential_id: nil, read_only_credential_id: nil,
                        enabled_role_types: [])
    post("/azure/subscription/link", {
      customer_uuid: customer_uuid,
      project_uuid: project_uuid,
      subscription_id: subscription_id,
      tenant_id: tenant_id,
      admin_credential_id: admin_credential_id,
      read_only_credential_id: read_only_credential_id,
      enabled_role_types: enabled_role_types
    }.compact)
  end

  def unlink_subscription(customer_uuid:, credential_id:, subscription_id:)
    post("/azure/subscription/unlink", {
      customer_uuid: customer_uuid,
      credential_id: credential_id,
      subscription_id: subscription_id
    })
  end

  # ---------------------------------------------------------------------------
  # Environment Info
  # ---------------------------------------------------------------------------

  def list_env_info
    get("/environment_info")
  end

  def get_env_info(customer_uuid:, project_uuid:, **filters)
    get("/environment_info/#{customer_uuid}/#{project_uuid}", filters)
  end

  def create_env_info(**attrs)
    post("/environment_info", attrs)
  end

  def update_env_info(customer_uuid:, project_uuid:, **attrs)
    put("/environment_info/#{customer_uuid}/#{project_uuid}", attrs)
  end

  def delete_env_info(customer_uuid:, project_uuid:, **filters)
    delete("/environment_info/#{customer_uuid}/#{project_uuid}", filters)
  end

  # ---------------------------------------------------------------------------
  # Onboarding
  # ---------------------------------------------------------------------------

  def aws_onboard(customer_uuid:, **params)
    post("/public/aws/onboarding/#{customer_uuid}", params)
  end

  def verify_onboard(customer_uuid:, account_id:)
    get("/public/aws/onboarding/verify/#{customer_uuid}/#{account_id}")
  end

  def monitoring_onboard(customer_uuid:, **params)
    post("/public/aws/monitoring/onboard/#{customer_uuid}/#{params.delete(:account_id)}", params)
  end

  def monitoring_remove(customer_uuid:, environment_uuid:)
    delete("/monitoring/remove", customer_uuid: customer_uuid, environment_uuid: environment_uuid)
  end

  # ---------------------------------------------------------------------------
  # AWS Lookups
  # ---------------------------------------------------------------------------

  def aws_regions
    get("/public/aws/regions")
  end

  def aws_availability_zones(region:)
    get("/public/aws/azs/#{region}")
  end

  def rds_engines(region:)
    get("/public/aws/rds/engines/#{region}")
  end

  def ec2_types
    get("/public/aws/ec2/types")
  end

  def eks_versions
    get("/public/aws/eks/versions")
  end

  # ---------------------------------------------------------------------------
  # Azure Lookups
  # ---------------------------------------------------------------------------

  def azure_regions(subscription_id:)
    get("/public/azure/regions", subscription_id: subscription_id)
  end

  def azure_vm_skus(location:, subscription_id:)
    get("/public/azure/vm-skus", location: location, subscription_id: subscription_id)
  end

  private

  attr_reader :conn

  def platform_auth_headers
    key = ENV.fetch("CS_PLATFORM_API_KEY", "")
    { "cs-intelligent-platform-header" => key }
  end
end
