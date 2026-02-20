# frozen_string_literal: true

class ModuleField < ApplicationRecord
  FIELD_TYPES = %w[string integer boolean enum list object].freeze
  CLASSIFICATIONS = %w[user_config dependency platform_managed hidden].freeze

  belongs_to :module_definition

  validates :name, presence: true, uniqueness: { scope: :module_definition_id }
  validates :label, presence: true
  validates :field_type, presence: true, inclusion: { in: FIELD_TYPES }
  validates :classification, presence: true, inclusion: { in: CLASSIFICATIONS }
  validate :data_source_must_be_known, if: -> { data_source.present? }

  scope :ordered, -> { order(:position) }
  scope :user_config, -> { where(classification: "user_config") }
  scope :dependency, -> { where(classification: "dependency") }
  scope :platform_managed, -> { where(classification: "platform_managed") }

  def default_for_env(env_type)
    defaults_by_env&.dig(env_type) || default_value
  end

  def validation=(val)
    if val.is_a?(String) && val.present?
      super(JSON.parse(val))
    elsif val.is_a?(String) && val.blank?
      super({})
    else
      super
    end
  rescue JSON::ParserError
    super(val)
  end

  def dynamic_options?
    data_source.present?
  end

  private

  def data_source_must_be_known
    return if DataSourceResolver.resolvable?(data_source)

    errors.add(:data_source, "unknown data source '#{data_source}'")
  end
end
