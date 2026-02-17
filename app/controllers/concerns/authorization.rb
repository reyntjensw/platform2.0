# frozen_string_literal: true

module Authorization
  extend ActiveSupport::Concern

  class NotAuthorizedError < StandardError; end

  # Role hierarchy from most to least privileged
  ROLE_HIERARCHY = %w[
    platform_admin
    reseller_admin
    customer_admin
    project_admin
    developer
    viewer
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
    when :manage
      can_manage?(resource)
    when :read
      can_read?(resource)
    else
      false
    end
  end

  # :manage — create, update, delete
  def can_manage?(resource)
    return true if current_user.platform_admin?
    return true if current_user.reseller_admin?

    case resource
    when Customer
      current_user.customer_admin? && owns_customer?(resource)
    when Project
      (current_user.customer_admin? && owns_customer_for_project?(resource)) ||
        (current_user.project_admin? && owns_project?(resource))
    when Environment
      (current_user.customer_admin? && owns_customer_for_environment?(resource)) ||
        (current_user.project_admin? && owns_project_for_environment?(resource))
    else
      false
    end
  end

  # :read — index, show
  def can_read?(resource)
    return true if can_manage?(resource)
    return true if current_user.developer? || current_user.viewer?

    false
  end

  # Ownership checks

  def owns_customer?(customer)
    customer.respond_to?(:uuid) &&
      current_user.customer_uuid == customer.uuid
  end

  def owns_customer_for_project?(project)
    project.respond_to?(:customer_uuid) &&
      current_user.customer_uuid == project.customer_uuid
  end

  def owns_project?(project)
    # project_admin scope — checked via project UUID stored on user or session
    project.respond_to?(:uuid) &&
      session[:project_uuids]&.include?(project.uuid)
  end

  def owns_customer_for_environment?(environment)
    environment.respond_to?(:customer_uuid) &&
      current_user.customer_uuid == environment.customer_uuid
  end

  def owns_project_for_environment?(environment)
    environment.respond_to?(:project_uuid) &&
      session[:project_uuids]&.include?(environment.project_uuid)
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
end
