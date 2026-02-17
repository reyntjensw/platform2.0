# frozen_string_literal: true

class Resource < ApplicationRecord
  ZONES = %w[public private global].freeze

  belongs_to :local_environment
  belongs_to :module_definition
  belongs_to :application_group, optional: true
  has_many :outgoing_connections, class_name: "Connection", foreign_key: :from_resource_id, dependent: :destroy
  has_many :incoming_connections, class_name: "Connection", foreign_key: :to_resource_id, dependent: :destroy

  validates :name, presence: true, uniqueness: { scope: :local_environment_id }
  validates :zone, inclusion: { in: ZONES }
  validate :zone_allowed_for_module

  before_validation :generate_name, on: :create, if: -> { name.blank? }
  before_validation :populate_defaults, on: :create

  def connections
    Connection.where("from_resource_id = ? OR to_resource_id = ?", id, id)
  end

  private

  def zone_allowed_for_module
    return unless module_definition && zone.present?
    unless module_definition.allowed_zones.include?(zone)
      errors.add(:zone, "#{zone} is not allowed for #{module_definition.display_name}. Allowed: #{module_definition.allowed_zones.join(', ')}")
    end
  end

  def generate_name
    suffix = SecureRandom.hex(3)
    base = module_definition&.name&.parameterize(separator: "_") || "resource"
    self.name = "#{base}-#{suffix}"
  end

  def populate_defaults
    return unless module_definition

    env_type = local_environment&.env_type
    defaults = {}

    module_definition.module_fields.user_config.each do |field|
      value = field.default_for_env(env_type)
      defaults[field.name] = value unless value.nil?
    end

    self.config = defaults.merge(config || {})
  end
end
