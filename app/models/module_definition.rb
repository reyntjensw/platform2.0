# frozen_string_literal: true

class ModuleDefinition < ApplicationRecord
  STATUSES = %w[draft live deprecated].freeze
  CLOUD_PROVIDERS = %w[aws azure gcp multi].freeze
  CATEGORIES = %w[compute database networking storage security monitoring other].freeze
  OWNERSHIPS = %w[platform reseller customer].freeze
  VISIBILITIES = %w[global reseller customer].freeze
  VALID_ZONES = %w[public private global].freeze
  VALID_PROVIDERS = %w[aws azure gcp kubernetes helm kubectl tls].freeze

  belongs_to :owner, polymorphic: true, optional: true
  has_many :module_fields, dependent: :destroy
  has_many :module_outputs, dependent: :destroy
  has_many :module_renderers, dependent: :destroy

  accepts_nested_attributes_for :module_fields, allow_destroy: true, reject_if: :all_blank
  accepts_nested_attributes_for :module_outputs, allow_destroy: true, reject_if: :all_blank
  accepts_nested_attributes_for :module_renderers, allow_destroy: true, reject_if: :all_blank

  validates :name, presence: true, uniqueness: { scope: :cloud_provider }
  validates :display_name, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :cloud_provider, presence: true, inclusion: { in: CLOUD_PROVIDERS }
  validates :category, presence: true, inclusion: { in: CATEGORIES }
  validates :ownership, presence: true, inclusion: { in: OWNERSHIPS }
  validates :visibility, presence: true, inclusion: { in: VISIBILITIES }
  validate :allowed_zones_valid
  validate :provider_dependencies_valid

  scope :live, -> { where(status: "live") }
  scope :by_category, ->(cat) { where(category: cat) if cat.present? }
  scope :by_cloud_provider, ->(cp) { where(cloud_provider: [cp, "multi"]) if cp.present? }

  scope :for_environment, ->(env) {
    live.where(cloud_provider: [env.cloud_provider, "multi"])
  }

  scope :visible_to, ->(customer) {
    where(visibility: "global")
      .or(where(ownership: "platform"))
  }

  def deployable?
    module_renderers.any?
  end

  def user_config_fields
    module_fields.where(classification: "user_config").order(:position)
  end

  private

  def allowed_zones_valid
    if allowed_zones.blank? || !allowed_zones.is_a?(Array) || allowed_zones.empty?
      errors.add(:allowed_zones, "must contain at least one zone")
      return
    end
    invalid = allowed_zones - VALID_ZONES
    if invalid.any?
      errors.add(:allowed_zones, "contains invalid zones: #{invalid.join(', ')}")
    end
  end

  def provider_dependencies_valid
    return if provider_dependencies.blank?
    unless provider_dependencies.is_a?(Array)
      errors.add(:provider_dependencies, "must be an array")
      return
    end
    invalid = provider_dependencies - VALID_PROVIDERS
    if invalid.any?
      errors.add(:provider_dependencies, "contains invalid providers: #{invalid.join(', ')}")
    end
  end
end
