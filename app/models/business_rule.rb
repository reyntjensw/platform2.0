# frozen_string_literal: true

class BusinessRule < ApplicationRecord
  SEVERITIES = %w[block warn info].freeze
  SCOPE_TYPES = %w[platform customer].freeze

  validates :name, presence: true, uniqueness: { scope: :scope_type }
  validates :severity, presence: true, inclusion: { in: SEVERITIES }
  validates :scope_type, presence: true, inclusion: { in: SCOPE_TYPES }
  validates :cloud_provider, presence: true
  validates :conditions, presence: true
  validates :customer_id, presence: true, if: -> { scope_type == "customer" }

  scope :enabled, -> { where(enabled: true) }
  scope :for_cloud_provider, ->(cp) { where(cloud_provider: [cp, "multi"]) }
  scope :platform_rules, -> { where(scope_type: "platform") }
  scope :customer_rules, ->(customer_id) { where(scope_type: "customer", customer_id: customer_id) }
end
