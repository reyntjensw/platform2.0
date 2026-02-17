# frozen_string_literal: true

class Customer
  include ApiBacked

  attribute :uuid, :string
  attribute :reseller_uuid, :string
  attribute :name, :string
  attribute :inactive, :boolean, default: false
  attribute :vat_number, :string
  attribute :invoicing_mail_address, :string
  attribute :keycloak_group_id, :string

  attr_accessor :commercial_address, :settings
end
