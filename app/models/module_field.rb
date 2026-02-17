# frozen_string_literal: true

class ModuleField < ApplicationRecord
  FIELD_TYPES = %w[string integer boolean enum list object].freeze
  CLASSIFICATIONS = %w[user_config dependency platform_managed hidden].freeze

  belongs_to :module_definition

  validates :name, presence: true, uniqueness: { scope: :module_definition_id }
  validates :label, presence: true
  validates :field_type, presence: true, inclusion: { in: FIELD_TYPES }
  validates :classification, presence: true, inclusion: { in: CLASSIFICATIONS }

  scope :ordered, -> { order(:position) }
  scope :user_config, -> { where(classification: "user_config") }
  scope :dependency, -> { where(classification: "dependency") }
  scope :platform_managed, -> { where(classification: "platform_managed") }

  def default_for_env(env_type)
    defaults_by_env&.dig(env_type) || default_value
  end
end
