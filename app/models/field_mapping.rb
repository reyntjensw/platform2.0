# frozen_string_literal: true

class FieldMapping < ApplicationRecord
  MAPPING_TYPES = %w[direct transform dependency_ref platform_inject].freeze
  TRANSFORMS = %w[to_string to_int wrap_list first_element bool_to_string json_encode].freeze

  belongs_to :module_renderer

  validates :platform_field, presence: true, uniqueness: { scope: :module_renderer_id }
  validates :renderer_variable, presence: true
  validates :mapping_type, presence: true, inclusion: { in: MAPPING_TYPES }
  validates :transform, inclusion: { in: TRANSFORMS }, allow_nil: true
end
