# frozen_string_literal: true

class TagMergerService
  # Walks the tenant hierarchy and merges tags from config.tags at each level.
  # Lower levels override higher levels.
  def self.merge(reseller, customer, project, environment)
    tags = { "managed_by" => "factorfifty" }

    tags.merge!(reseller.config&.dig("tags") || {}) if reseller
    tags.merge!(customer.config&.dig("tags") || {}) if customer

    tags["reseller"] = reseller&.slug || reseller&.name&.parameterize
    tags["customer"] = customer&.slug || customer&.name&.parameterize
    tags["project"] = project&.slug || project&.name&.parameterize
    tags["environment"] = environment.name
    tags["env_type"] = environment.env_type

    tags.merge!(environment.config&.dig("tags") || {})

    tags.transform_keys(&:to_s)
  end
end
