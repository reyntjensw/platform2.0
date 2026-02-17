# frozen_string_literal: true

class AuditLog < ApplicationRecord
  ACTIONS = %w[created updated deleted deployed promoted].freeze

  validates :user_uuid, presence: true
  validates :reseller_uuid, presence: true
  validates :action, presence: true, inclusion: { in: ACTIONS }
  validates :resource_type, presence: true

  scope :for_user, ->(uuid) { where(user_uuid: uuid) }
  scope :for_reseller, ->(uuid) { where(reseller_uuid: uuid) }
  scope :for_resource, ->(type, uuid) { where(resource_type: type, resource_uuid: uuid) }
  scope :recent, -> { order(created_at: :desc) }
end
