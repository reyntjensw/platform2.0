# frozen_string_literal: true

class AutoPlacementService
  # Determines the best zone for a new resource based on the module's
  # allowed_zones and any active business rules.
  #
  # Logic:
  #   1. Single allowed zone → return it
  #   2. Check THEN conditions across ALL matching rules (any severity)
  #      for resource.subnet_type MUST_BE directives → use that zone
  #   3. Fall back to restriction-based logic for block rules
  #   4. Default → first in allowed_zones array
  def self.determine_zone(module_definition, customer = nil)
    allowed = module_definition.allowed_zones
    return allowed.first if allowed.size == 1

    rules = applicable_rules(module_definition, customer)

    # Primary: derive target zone from THEN conditions (any severity).
    # The THEN condition is the source of truth, not the action.
    target_zone = find_target_zone_from_conditions(rules, module_definition)
    return target_zone if target_zone && allowed.include?(target_zone)

    # Secondary: restriction-based logic from block rules
    restricted_zones = zones_restricted_by_rules(rules, module_definition)
    available = allowed - restricted_zones
    available.any? ? available.first : allowed.first
  end

  def self.applicable_rules(module_definition, customer)
    scope = BusinessRule.enabled.for_cloud_provider(module_definition.cloud_provider)
    if customer
      scope.where(scope_type: "platform")
           .or(scope.where(scope_type: "customer", customer_id: customer.id))
    else
      scope.where(scope_type: "platform")
    end
  end

  # Scans ALL matching rules (any severity) for THEN conditions that
  # specify a target zone via resource.subnet_type MUST_BE / ==.
  # This is the authoritative zone directive.
  def self.find_target_zone_from_conditions(rules, module_definition)
    rules.find_each do |rule|
      next unless rule_matches_module?(rule, module_definition)

      conditions = rule.conditions
      next unless conditions

      if conditions["if_conditions"]
        (conditions["then_conditions"] || []).each do |tc|
          if tc["field"] == "resource.subnet_type" && tc["operator"].in?(["MUST_BE", "=="])
            return tc["value"]
          end
        end
      end
    end
    nil
  end

  def self.zones_restricted_by_rules(rules, module_definition)
    restricted = []
    rules.where(severity: "block").find_each do |rule|
      next unless rule_matches_module?(rule, module_definition)

      conditions = rule.conditions
      if conditions["if_conditions"]
        (conditions["then_conditions"] || []).each do |tc|
          if tc["field"] == "resource.subnet_type" && tc["operator"].in?(["MUST_BE", "=="])
            target = tc["value"]
            restricted += (ModuleDefinition::VALID_ZONES - [target])
          end
        end
      else
        restricted << conditions["restricted_zone"] if conditions["restricted_zone"]
      end
    end
    restricted.uniq
  end

  def self.rule_matches_module?(rule, module_definition)
    conditions = rule.conditions
    return false unless conditions

    if conditions["if_conditions"]
      (conditions["if_conditions"] || []).all? do |c|
        PlacementValidatorService.send(:evaluate_condition, c, module_definition, nil)
      end
    else
      matches_module_legacy?(conditions, module_definition)
    end
  end

  def self.matches_module_legacy?(conditions, module_definition)
    return true if conditions["categories"]&.include?(module_definition.category)
    return true if conditions["module_names"]&.include?(module_definition.name)
    false
  end

  private_class_method :applicable_rules, :find_target_zone_from_conditions,
                       :zones_restricted_by_rules, :rule_matches_module?,
                       :matches_module_legacy?
end
