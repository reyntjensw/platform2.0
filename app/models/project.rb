# frozen_string_literal: true

class Project
  include ApiBacked

  attribute :uuid, :string
  attribute :customer_uuid, :string
  attribute :name, :string
  attribute :provider, :string
  attribute :region, :string
  attribute :status, :string

  attr_accessor :settings, :project_region

  # API returns project_region — sync it to region
  def project_region=(val)
    @project_region = val
    self.region = val if region.blank?
  end
end
