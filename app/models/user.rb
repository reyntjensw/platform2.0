# frozen_string_literal: true

class User
  include ApiBacked

  attribute :uuid, :string
  attribute :sub, :string
  attribute :email, :string
  attribute :name, :string
  attribute :reseller_uuid, :string
  attribute :customer_uuid, :string
  attribute :keycloak_group_id, :string

  attr_accessor :roles

  def roles
    @roles || []
  end

  # Platform admin requires both the Keycloak role AND an allowed email domain.
  # This prevents accidental privilege escalation if a user is misconfigured in Keycloak.
  def platform_admin?
    roles.include?("platform_admin") && platform_admin_email_allowed?
  end

  def reseller_admin? = roles.include?("reseller_admin")
  def customer_admin? = roles.include?("customer_admin")
  def customer_viewer? = roles.include?("customer_viewer")

  # Effective role: the highest-privilege role this user actually holds.
  # Useful for audit logging and debugging.
  def effective_role
    Authorization::ROLE_HIERARCHY.find { |r| roles.include?(r) } || "none"
  end

  # Returns true if the user is scoped to a specific customer
  def customer_scoped?
    (customer_admin? || customer_viewer?) && customer_uuid.present?
  end

  private

  def platform_admin_email_allowed?
    allowed_domains = ENV.fetch("PLATFORM_ADMIN_EMAIL_DOMAINS", "").split(",").map(&:strip).reject(&:empty?)
    return true if allowed_domains.empty? # No restriction configured — allow all (backwards compatible)

    domain = email.to_s.split("@").last.to_s.downcase
    allowed_domains.any? { |d| domain == d.downcase }
  end
end
