# frozen_string_literal: true

class Connection < ApplicationRecord
  CONNECTION_TYPES = %w[dependency reference].freeze

  belongs_to :from_resource, class_name: "Resource"
  belongs_to :to_resource, class_name: "Resource"

  validates :connection_type, presence: true, inclusion: { in: CONNECTION_TYPES }
  validates :from_resource_id, uniqueness: { scope: :to_resource_id }
  validate :no_self_connection

  private

  def no_self_connection
    errors.add(:to_resource_id, "cannot connect to itself") if from_resource_id == to_resource_id
  end
end
