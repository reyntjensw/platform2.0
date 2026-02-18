# frozen_string_literal: true

class GlobalTag < ApplicationRecord
  validates :key, presence: true, uniqueness: true,
                  format: { with: /\A[a-zA-Z0-9_\-:\/\.]+\z/, message: "only allows alphanumeric, hyphens, underscores, colons, slashes, and dots" }
  validates :value, presence: true

  scope :enabled, -> { where(enabled: true) }
  scope :by_key, -> { order(:key) }

  # Returns a hash of all enabled global tags { "key" => "value", ... }
  def self.to_tag_hash
    enabled.by_key.pluck(:key, :value).to_h
  end
end
