# frozen_string_literal: true

class TagMergerService
  # Walks the tenant hierarchy and merges tags from config.tags at each level.
  # Lower levels override higher levels.
  def self.merge(reseller, customer, project, environment)
    tags = GlobalTag.to_tag_hash

    tags.merge!(reseller.config&.dig("tags") || {}) if reseller
    tags.merge!(customer.config&.dig("tags") || {}) if customer

    tags["customer"] = customer&.slug || customer&.name&.parameterize
    tags["project"] = project&.slug || project&.name&.parameterize
    tags["environment"] = environment.name
    tags["env_type"] = environment.env_type

    tags.merge!(environment.config&.dig("tags") || {})

    tags.transform_keys(&:to_s)
  end
end
