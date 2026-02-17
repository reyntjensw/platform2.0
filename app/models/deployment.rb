# frozen_string_literal: true

class Deployment < ApplicationRecord
  STATUSES = %w[pending dispatched planning planned applying completed failed].freeze

  belongs_to :local_environment

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :triggered_by_uuid, presence: true

  scope :recent, -> { order(created_at: :desc) }
  scope :latest, -> { recent.first }

  def planning? = status == "planning"
  def planned? = status == "planned"
  def completed? = status == "completed"
  def failed? = status == "failed"
  def in_progress? = %w[pending dispatched planning applying].include?(status)
end
