# frozen_string_literal: true

module AuthorizationHelper
  # Returns true if the current user can perform write actions (create/edit/delete).
  # Returns false for customer_viewer (read-only role).
  def can_manage_resource?
    return false unless current_user
    return true if current_user.platform_admin?
    return false if current_user.customer_viewer?
    return true if current_user.reseller_admin?
    return true if current_user.customer_admin?

    false
  end

  # Returns true if the current user can create new customers.
  # Only platform_admin and reseller_admin can create customers.
  def can_create_customer?
    current_user&.platform_admin? || current_user&.reseller_admin?
  end
end
