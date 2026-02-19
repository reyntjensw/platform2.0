# frozen_string_literal: true

module Authorization
  extend ActiveSupport::Concern

  class NotAuthorizedError < StandardError; end

  # Simplified four-role hierarchy from most to least privileged
  ROLE_HIERARCHY = %w[
    platform_admin
    reseller_admin
    customer_admin
    customer_viewer
  ].freeze

  included do
    rescue_from NotAuthorizedError, with: :render_forbidden
  end

  # Check whether the current user is authorized for the given action on a resource.
  # Raises NotAuthorizedError if not.
  #
  # Usage:
  #   authorize!(:manage, @customer)
  #   authorize!(:read, @environment)
  #
  def authorize!(action, resource = nil)
    raise NotAuthorizedError, "Not authenticated" unless current_user

    return if authorized?(action, resource)

    raise NotAuthorizedError, "You are not authorized to #{action} this resource"
  end

  private

  def authorized?(action, resource)
    case action.to_sym
    when :manage then can_manage?(resource)
    when :read   then can_read?(resource)
    else false
    end
  end

  # :manage — create, update, delete
  def can_manage?(resource)
    return true if current_user.platform_admin?
    return false if current_user.customer_viewer?

    # Symbol resources represent global resource types (e.g. :keycloak_users)
    if resource.is_a?(Symbol)
      return true if resource == :keycloak_users
      return false
    end

    if current_user.reseller_admin?
      return reseller_owns_resource?(resource)
    end

    if current_user.customer_admin?
      return customer_owns_resource?(resource)
    end

    false
  end

  # :read — index, show
  def can_read?(resource)
    return true if current_user.platform_admin?

    # Symbol resources represent global resource types (e.g. :keycloak_users)
    if resource.is_a?(Symbol)
      return true if resource == :keycloak_users
      return false
    end

    if current_user.reseller_admin?
      return reseller_owns_resource?(resource)
    end

    if current_user.customer_admin? || current_user.customer_viewer?
      return customer_owns_resource?(resource)
    end

    false
  end

  # Check if the resource belongs to the reseller_admin's reseller
  def reseller_owns_resource?(resource)
    reseller_uuid = current_user.reseller_uuid
    return false if reseller_uuid.blank?

    case resource
    when Customer
      resource.reseller_uuid == reseller_uuid
    when Project, Environment, LocalEnvironment
      resource.respond_to?(:customer_uuid) &&
        customer_belongs_to_reseller?(resource.customer_uuid, reseller_uuid)
    else
      false
    end
  end

  # Check if the resource belongs to the customer-scoped user's customer
  def customer_owns_resource?(resource)
    customer_uuid = current_user.customer_uuid
    return false if customer_uuid.blank?

    case resource
    when Customer
      resource.uuid == customer_uuid
    when Project
      resource.respond_to?(:customer_uuid) && resource.customer_uuid == customer_uuid
    when Environment, LocalEnvironment
      resource.respond_to?(:customer_uuid) && resource.customer_uuid == customer_uuid
    else
      false
    end
  end

  def customer_belongs_to_reseller?(customer_uuid, reseller_uuid)
    client = CsInternalApiClient.new
    response = client.get_customer(uuid: customer_uuid)
    response.success? && response.data&.dig(:reseller_uuid) == reseller_uuid
  rescue
    false
  end

  # Returns the numeric privilege level for a role (lower = more privileged)
  def role_level(role)
    ROLE_HIERARCHY.index(role.to_s) || ROLE_HIERARCHY.length
  end

  # Check if the user has at least the given minimum role
  def has_role?(minimum_role)
    return false unless current_user
    current_user.roles.any? { |r| role_level(r) <= role_level(minimum_role) }
  end

  def render_forbidden
    respond_to do |format|
      format.html { render file: Rails.root.join("public/403.html"), status: :forbidden, layout: false }
      format.json { render json: { error: "Forbidden" }, status: :forbidden }
    end
  end

  def require_platform_admin
    raise NotAuthorizedError, "Platform admin access required" unless current_user&.platform_admin?
  end
end
