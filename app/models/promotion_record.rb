# frozen_string_literal: true

class PromotionRecord < ApplicationRecord
  STATUSES = %w[pending awaiting_approval approved executing completed failed rejected expired].freeze

  belongs_to :source_environment, class_name: "LocalEnvironment"
  belongs_to :target_environment, class_name: "LocalEnvironment"
  belongs_to :source_snapshot, class_name: "EnvironmentSnapshot"
  belongs_to :target_snapshot, class_name: "EnvironmentSnapshot", optional: true

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :user_uuid, presence: true

  scope :recent, -> { order(created_at: :desc) }
  scope :in_progress, -> { where(status: %w[pending awaiting_approval approved executing]) }
  scope :awaiting_approval, -> { where(status: "awaiting_approval") }
end
