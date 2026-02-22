# frozen_string_literal: true

class LocalEnvironment < ApplicationRecord
  ENV_TYPES = %w[dev acc prd shared].freeze
  CLOUD_PROVIDERS = %w[aws azure gcp].freeze
  IAC_ENGINES = %w[opentofu].freeze
  EXECUTION_MODES = %w[platform private].freeze

  belongs_to :local_project
  has_many :resources, dependent: :destroy
  has_many :deployments, dependent: :destroy
  has_many :application_groups, dependent: :destroy
  has_many :environment_snapshots, dependent: :destroy
  has_many :promotion_records_as_source, class_name: "PromotionRecord", foreign_key: :source_environment_id, dependent: :destroy
  has_many :promotion_records_as_target, class_name: "PromotionRecord", foreign_key: :target_environment_id, dependent: :nullify
  has_many :canvas_locks, foreign_key: :environment_id, dependent: :destroy
  has_many :global_tags, as: :taggable, dependent: :destroy

  validates :name, presence: true
  validates :env_type, presence: true, inclusion: { in: ENV_TYPES }
  validates :cloud_provider, presence: true, inclusion: { in: CLOUD_PROVIDERS }
  validates :iac_engine, presence: true, inclusion: { in: IAC_ENGINES }
  validates :execution_mode, presence: true, inclusion: { in: EXECUTION_MODES }

  delegate :local_customer, to: :local_project
  delegate :local_reseller, to: :local_customer, allow_nil: true

  # Region lives on the project — delegate so all existing callers keep working
  def region
    local_project&.default_region
  end

  # Expose customer_uuid for authorization checks.
  # The local_customer.slug stores the platform customer UUID.
  def customer_uuid
    local_customer&.slug
  end

  def aws? = cloud_provider == "aws"
  def azure? = cloud_provider == "azure"
  def gcp? = cloud_provider == "gcp"
  def platform_runner? = execution_mode == "platform"
  def private_runner? = execution_mode == "private"
end
