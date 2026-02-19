# frozen_string_literal: true

class KeycloakUser
  include ApiBacked

  attribute :id, :string
  attribute :email, :string
  attribute :first_name, :string
  attribute :last_name, :string
  attribute :enabled, :boolean, default: true
  attribute :email_verified, :boolean, default: false
  attribute :customer_uuid, :string
  attribute :reseller_uuid, :string

  attr_accessor :roles

  def roles
    @roles || []
  end

  def display_name
    [first_name, last_name].compact.join(" ").presence || email
  end

  def primary_role
    roles.reject { |r| r.start_with?("default-roles-") }.first
  end

  def to_param
    id
  end

  def uuid
    id
  end

  def self.from_api(attrs)
    return new if attrs.nil?

    attrs = attrs.with_indifferent_access
    nested = attrs[:attributes] || {}

    attrs[:customer_uuid] ||= Array(nested[:customer_uuid]).first
    attrs[:reseller_uuid] ||= Array(nested[:reseller_uuid]).first

    super(attrs)
  end
end
