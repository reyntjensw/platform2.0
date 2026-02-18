# frozen_string_literal: true

class CanvasLock < ApplicationRecord
  belongs_to :environment, class_name: "LocalEnvironment"

  validates :device_id, presence: true
  validates :user_email, presence: true
  validates :expires_at, presence: true

  def active?
    expires_at > Time.current
  end
end
