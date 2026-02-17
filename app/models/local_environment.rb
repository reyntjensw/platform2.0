# frozen_string_literal: true

class LocalEnvironment < ApplicationRecord
  ENV_TYPES = %w[dev acc prd shared].freeze
  CLOUD_PROVIDERS = %w[aws azure gcp].freeze
  IAC_ENGINES = %w[opentofu].freeze

  belongs_to :local_project
  has_many :resources, dependent: :destroy
  has_many :deployments, dependent: :destroy
  has_many :application_groups, dependent: :destroy

  validates :name, presence: true
  validates :env_type, presence: true, inclusion: { in: ENV_TYPES }
  validates :cloud_provider, presence: true, inclusion: { in: CLOUD_PROVIDERS }
  validates :iac_engine, presence: true, inclusion: { in: IAC_ENGINES }

  delegate :local_customer, to: :local_project
  delegate :local_reseller, to: :local_customer, allow_nil: true

  def aws? = cloud_provider == "aws"
  def azure? = cloud_provider == "azure"
end
