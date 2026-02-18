# frozen_string_literal: true

class EnvironmentSnapshot < ApplicationRecord
  belongs_to :local_environment
  has_many :promotion_records_as_source, class_name: "PromotionRecord", foreign_key: :source_snapshot_id, dependent: :destroy
  has_many :promotion_records_as_target, class_name: "PromotionRecord", foreign_key: :target_snapshot_id, dependent: :nullify

  validates :version, presence: true
  validates :snapshot_data, presence: true

  scope :latest, -> { order(created_at: :desc) }

  # Immutability guard: prevent updates to persisted snapshots (deletes are allowed)
  before_update { raise ActiveRecord::ReadOnlyRecord if persisted? }
end
