# frozen_string_literal: true

class GlobalTag < ApplicationRecord
  TAGGABLE_TYPES = %w[LocalReseller LocalCustomer LocalProject LocalEnvironment].freeze
  LEVEL_LABELS = {
    nil => "Platform",
    "LocalReseller" => "Reseller",
    "LocalCustomer" => "Customer",
    "LocalProject" => "Project",
    "LocalEnvironment" => "Environment"
  }.freeze

  belongs_to :taggable, polymorphic: true, optional: true

  validates :key, presence: true,
                  format: { with: /\A[a-zA-Z0-9_\-:\/\.]+\z/,
                            message: "only allows alphanumeric, hyphens, underscores, colons, slashes, and dots" }
  validates :value, presence: true
  validates :key, uniqueness: { scope: [:taggable_type, :taggable_id] }

  scope :enabled, -> { where(enabled: true) }
  scope :by_key, -> { order(:key) }
  scope :platform, -> { where(taggable_type: nil, taggable_id: nil) }
  scope :for_taggable, ->(record) { where(taggable: record) }

  # Human-readable level label
  def level_label
    LEVEL_LABELS[taggable_type] || "Platform"
  end

  # Returns a hash of all enabled platform-level tags { "key" => "value", ... }
  def self.to_tag_hash
    platform.enabled.by_key.pluck(:key, :value).to_h
  end

  # Merges tags down the hierarchy for a given environment.
  # Lower levels override higher levels on key conflicts.
  #
  #   Platform → Reseller → Customer → Project → Environment
  #
  # Returns { "key" => "value", ... }
  def self.merged_tags_for(environment)
    project  = environment.local_project
    customer = project.local_customer
    reseller = customer.local_reseller

    tags = {}

    # 1. Platform-level (base)
    platform.enabled.by_key.each { |t| tags[t.key] = t.value }

    # 2. Reseller-level
    if reseller
      for_taggable(reseller).enabled.by_key.each { |t| tags[t.key] = t.value }
    end

    # 3. Customer-level
    for_taggable(customer).enabled.by_key.each { |t| tags[t.key] = t.value }

    # 4. Project-level
    for_taggable(project).enabled.by_key.each { |t| tags[t.key] = t.value }

    # 5. Environment-level (highest priority)
    for_taggable(environment).enabled.by_key.each { |t| tags[t.key] = t.value }

    tags
  end

  # Returns all tags at each level for display purposes.
  # Returns an array of { level:, tags: [...] } hashes.
  def self.tags_by_level_for(environment)
    project  = environment.local_project
    customer = project.local_customer
    reseller = customer.local_reseller

    levels = []
    levels << { level: "Platform", taggable: nil, tags: platform.by_key.to_a }
    levels << { level: "Reseller (#{reseller.name})", taggable: reseller, tags: for_taggable(reseller).by_key.to_a } if reseller
    levels << { level: "Customer (#{customer.name})", taggable: customer, tags: for_taggable(customer).by_key.to_a }
    levels << { level: "Project (#{project.name})", taggable: project, tags: for_taggable(project).by_key.to_a }
    levels << { level: "Environment (#{environment.name})", taggable: environment, tags: for_taggable(environment).by_key.to_a }
    levels
  end
end
