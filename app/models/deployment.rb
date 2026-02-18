# frozen_string_literal: true

class Deployment < ApplicationRecord
  STATUSES = %w[pending dispatched planning planned applying completed failed rejected].freeze
  APPROVAL_STATUSES = %w[pending_approval approved rejected].freeze

  belongs_to :local_environment
  has_many :deployment_layers, dependent: :destroy

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :triggered_by_uuid, presence: true
  validates :approval_status, inclusion: { in: APPROVAL_STATUSES }, allow_nil: true

  scope :recent, -> { order(created_at: :desc) }
  scope :latest, -> { recent.first }

  def planning? = status == "planning"
  def planned? = status == "planned"
  def completed? = status == "completed"
  def failed? = status == "failed"
  def rejected? = status == "rejected"
  def in_progress? = %w[pending dispatched planning applying].include?(status)
  def approved? = approval_status == "approved"
end
