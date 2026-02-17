# frozen_string_literal: true

class Environment
  include ApiBacked

  # CS Internal API fields
  attribute :uuid, :string
  attribute :project_uuid, :string
  attribute :customer_uuid, :string
  attribute :name, :string
  attribute :environment_type, :string
  attribute :provider, :string
  attribute :region, :string
  attribute :account_id, :string
  attribute :subscription_id, :string
  attribute :status, :string

  # Platform API merged fields
  attribute :finops_enabled, :boolean, default: false
  attribute :secops_enabled, :boolean, default: false
  attribute :monitoring_enabled, :boolean, default: false
  attribute :aws_role_arn, :string
  attribute :azure_subscription_id, :string

  attr_accessor :settings
end
