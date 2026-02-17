# frozen_string_literal: true

class Reseller
  include ApiBacked

  attribute :uuid, :string
  attribute :name, :string
  attribute :inactive, :boolean, default: false
  attribute :vat_number, :string
  attribute :invoicing_mail_address, :string
  attribute :keycloak_group_id, :string

  attr_accessor :commercial_address, :settings
end
