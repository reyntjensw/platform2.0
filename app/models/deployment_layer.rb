# frozen_string_literal: true

class DeploymentLayer < ApplicationRecord
  STATUSES = %w[pending dispatched executing completed failed skipped].freeze

  belongs_to :deployment

  validates :index, presence: true, uniqueness: { scope: :deployment_id }
  validates :state_key, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :ordered, -> { order(:index) }

  def pending? = status == "pending"
  def dispatched? = status == "dispatched"
  def executing? = status == "executing"
  def completed? = status == "completed"
  def failed? = status == "failed"
  def skipped? = status == "skipped"
end
