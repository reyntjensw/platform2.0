# frozen_string_literal: true

class ModuleVersion < ApplicationRecord
  belongs_to :module_renderer

  validates :version_ref, presence: true, uniqueness: { scope: :module_renderer_id }

  scope :recent, -> { order(scanned_at: :desc) }
  scope :published, -> { where.not(published_at: nil) }
  scope :breaking, -> { where(breaking: true) }

  def non_breaking? = !breaking?

  def added_vars
    compatibility_report&.dig("added") || []
  end

  def removed_vars
    compatibility_report&.dig("removed") || []
  end

  def changed_vars
    compatibility_report&.dig("changed") || []
  end
end
