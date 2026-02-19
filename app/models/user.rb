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

  def platform_admin? = roles.include?("platform_admin")
  def reseller_admin? = roles.include?("reseller_admin")
  def customer_admin? = roles.include?("customer_admin")
  def customer_viewer? = roles.include?("customer_viewer")

  # Returns true if the user is scoped to a specific customer
  def customer_scoped?
    (customer_admin? || customer_viewer?) && customer_uuid.present?
  end
end
