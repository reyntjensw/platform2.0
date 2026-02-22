# frozen_string_literal: true

class CostApiClient < ApiClient::Base
  def initialize
    @conn = self.class.connection(
      ENV.fetch("REPORTING_API_URL", "http://localhost:8000"),
      timeout: 30,
      headers: platform_auth_headers
    )
  end

  def daily_spend(params)
    post("/cost/daily_spend", params)
  end

  def service_spend(params)
    post("/cost/service_spend", params)
  end

  def storage_spend(params)
    post("/cost/storage_spend", params)
  end

  def monthly_spend_trend(params)
    post("/cost/monthly_spend_trend", params)
  end

  def account_spend_distribution(params)
    post("/cost/account_spend_distribution", params)
  end

  def top_services(params)
    post("/cost/top_services", params)
  end
  def commitments(params)
    post("/cost-savings/commitments", params)
  end

  def savings_metrics(params)
    post("/cost-savings/metrics", params)
  end

  def accounts(customer_uuid, provider: nil)
    params = provider ? { provider: provider } : {}
    get("/cost/accounts/#{customer_uuid}", params)
  end

  def services(customer_uuid, provider: nil)
    params = provider ? { provider: provider } : {}
    get("/cost/services/#{customer_uuid}", params)
  end

  def inventory_resources(customer_uuid, body)
    post("/inventory/customers/#{customer_uuid}/resources/by-tag/grouped", body)
  end

  private

  attr_reader :conn

  def platform_auth_headers
    key = ENV.fetch("CS_PLATFORM_API_KEY", "")
    { "cs-intelligent-platform-header" => key }
  end
end
