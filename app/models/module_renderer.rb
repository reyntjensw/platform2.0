# frozen_string_literal: true

class ModuleRenderer < ApplicationRecord
  ENGINES = %w[opentofu].freeze
  SOURCE_TYPES = %w[git registry s3 npm inline].freeze
  SCAN_STATUSES = %w[pending scanning ready error].freeze

  belongs_to :module_definition
  belongs_to :git_credential, optional: true
  has_many :field_mappings, dependent: :destroy
  has_many :module_versions, dependent: :destroy

  validates :engine, presence: true, inclusion: { in: ENGINES },
            uniqueness: { scope: :module_definition_id }
  validates :source_type, presence: true, inclusion: { in: SOURCE_TYPES }
  validates :source_url, presence: true
end
