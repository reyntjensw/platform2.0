# frozen_string_literal: true

class Project
  include ApiBacked

  attribute :uuid, :string
  attribute :customer_uuid, :string
  attribute :name, :string
  attribute :provider, :string
  attribute :status, :string

  attr_accessor :settings, :region
end
