# frozen_string_literal: true

class CsInternalApiClient < ApiClient::Base
  LIST_CACHE_TTL = 60.seconds
  RECORD_CACHE_TTL = 5.minutes

  def initialize
    @conn = self.class.connection(
      ENV.fetch("CS_INTERNAL_API_URL"),
      headers: platform_auth_headers
    )
  end

  # Resellers
  def get_reseller(uuid:)     = cached("cs:reseller:#{uuid}", RECORD_CACHE_TTL) { get("/resellers/#{uuid}") }
  def list_resellers           = cached("cs:resellers", LIST_CACHE_TTL) { get("/resellers") }

  # Customers
  def list_customers(reseller_uuid:) = cached("cs:customers:#{reseller_uuid}", LIST_CACHE_TTL) { get("/customers", reseller_uuid: reseller_uuid) }
  def get_customer(uuid:)             = cached("cs:customer:#{uuid}", RECORD_CACHE_TTL) { get("/customers/#{uuid}") }

  # Projects
  def list_projects(reseller_uuid:)
    cached("cs:projects:#{reseller_uuid}", LIST_CACHE_TTL) { get("/projects", reseller_uuid: reseller_uuid) }
  end

  def list_customer_projects(customer_uuid:, reseller_uuid:)
    cached("cs:customer_projects:#{customer_uuid}", LIST_CACHE_TTL) { get("/customers/#{customer_uuid}/projects", reseller_uuid: reseller_uuid) }
  end

  def list_customer_projects_summary(customer_uuid:, reseller_uuid:)
    cached("cs:customer_projects_summary:#{customer_uuid}", LIST_CACHE_TTL) { get("/customers/#{customer_uuid}/projects/summary", reseller_uuid: reseller_uuid) }
  end
  def get_project(uuid:)              = cached("cs:project:#{uuid}", RECORD_CACHE_TTL) { get("/projects/#{uuid}") }
  def create_project(attrs)           = invalidate_and("cs:projects:*") { post("/projects", attrs) }
  def update_project(uuid:, attrs:)   = invalidate_and("cs:project:#{uuid}", "cs:projects:*") { put("/projects/#{uuid}", attrs) }

  # Environments
  def list_environments(project_uuid:) = cached("cs:environments:#{project_uuid}", LIST_CACHE_TTL) { get("/environments", project_uuid: project_uuid) }
  def get_environment(uuid:)            = cached("cs:environment:#{uuid}", RECORD_CACHE_TTL) { get("/environments/#{uuid}") }
  def create_environment(attrs)         = invalidate_and("cs:environments:*") { post("/environments", attrs) }
  def update_environment(uuid:, attrs:) = invalidate_and("cs:environment:#{uuid}", "cs:environments:*") { put("/environments/#{uuid}", attrs) }
  def delete_environment(uuid:)         = invalidate_and("cs:environment:#{uuid}", "cs:environments:*") { delete("/environments/#{uuid}") }

  # Regions
  def list_regions(cloud_provider: nil)
    params = {}
    params[:cloud_provider] = cloud_provider if cloud_provider
    cache_key = "cs:regions:#{cloud_provider || 'all'}"
    cached(cache_key, LIST_CACHE_TTL) { get("/regions", **params) }
  end

  # Users
  def list_users(reseller_uuid:) = cached("cs:users:#{reseller_uuid}", LIST_CACHE_TTL) { get("/users", reseller_uuid: reseller_uuid) }
  def get_user(uuid:)             = cached("cs:user:#{uuid}", RECORD_CACHE_TTL) { get("/users/#{uuid}") }
  def find_user_by_email(email:)  = get("/users", email: email)

  # Keycloak Users
  def list_keycloak_users(customer_uuid: nil, reseller_uuid: nil)
    params = {}
    params[:customer_uuid] = customer_uuid if customer_uuid
    params[:reseller_uuid] = reseller_uuid if reseller_uuid
    get("/keycloak-users", **params)
  end

  def get_keycloak_user(id:)            = get("/keycloak-users/#{id}")
  def create_keycloak_user(attrs)       = post("/keycloak-users", attrs)
  def update_keycloak_user(id:, attrs:) = put("/keycloak-users/#{id}", attrs)
  def delete_keycloak_user(id:)         = delete("/keycloak-users/#{id}")

  # Keycloak User Roles
  def get_keycloak_user_roles(user_id:)              = get("/keycloak-users/#{user_id}/roles")
  def assign_keycloak_user_roles(user_id:, role_names:) = post("/keycloak-users/#{user_id}/roles", { role_names: role_names })
  def remove_keycloak_user_roles(user_id:, role_names:)
    wrap { conn.delete("/keycloak-users/#{user_id}/roles") { |req| req.body = { role_names: role_names } } }
  end

  private

  attr_reader :conn

  def platform_auth_headers
    key = ENV.fetch("CS_PLATFORM_API_KEY", "")
    { "cs-intelligent-platform-header" => key }
  end

  def cached(key, ttl)
    result = Rails.cache.read(key)
    return result if result

    result = yield
    Rails.cache.write(key, result, expires_in: ttl) if result.is_a?(ApiClient::Response) && result.success?
    result
  end

  def invalidate_and(*patterns)
    patterns.each do |pattern|
      if pattern.include?("*")
        Rails.cache.delete_matched(pattern)
      else
        Rails.cache.delete(pattern)
      end
    end
    yield
  end
end
