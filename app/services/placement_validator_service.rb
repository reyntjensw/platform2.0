# frozen_string_literal: true

class PlacementValidatorService
  Result = Struct.new(:valid, :errors, :warnings, keyword_init: true)

  # Validates a resource placement against all applicable business rules.
  #
  # Returns a Result with:
  #   - valid: false if any "block" rule is violated
  #   - errors: array of block-level violations
  #   - warnings: array of warn-level violations
  def self.validate(module_definition, zone, customer = nil)
    errors = []
    warnings = []

    rules = applicable_rules(module_definition, customer)
    rules.find_each do |rule|
      next unless violates_rule?(rule, module_definition, zone)

      case rule.severity
      when "block"
        errors << { rule_id: rule.id, rule_name: rule.name, message: rule.description }
      when "warn"
        warnings << { rule_id: rule.id, rule_name: rule.name, message: rule.description }
      end
    end

    Result.new(valid: errors.empty?, errors: errors, warnings: warnings)
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

  # Checks whether a rule is violated by the given module + zone combination.
  # Supports both the new structured format and the legacy format.
  def self.violates_rule?(rule, module_definition, zone)
    conditions = rule.conditions
    return false unless conditions

    if conditions["if_conditions"]
      violates_structured_rule?(conditions, module_definition, zone)
    else
      violates_legacy_rule?(conditions, module_definition, zone)
    end
  end

  # ── New structured format ──────────────────────────
  # if_conditions: array of { field, operator, value }
  # then_conditions: array of { field, operator, value }
  #
  # A rule is violated when ALL if_conditions match AND
  # at least one then_condition is NOT satisfied.
  def self.violates_structured_rule?(conditions, module_definition, zone)
    if_conds = conditions["if_conditions"] || []
    then_conds = conditions["then_conditions"] || []

    # All IF conditions must match for the rule to apply
    return false unless if_conds.all? { |c| evaluate_condition(c, module_definition, zone) }

    # Rule applies — check if any THEN condition is violated
    then_conds.any? { |c| !evaluate_condition(c, module_definition, zone) }
  end

  # Evaluates a single condition { field, operator, value } against the context.
  def self.evaluate_condition(cond, module_definition, zone)
    actual = resolve_field(cond["field"], module_definition, zone)
    expected = cond["value"]
    operator = cond["operator"]

    # When actual is an array (e.g. resource.type returns [name, category]),
    # the condition matches if ANY of the actual values satisfies it.
    if actual.is_a?(Array)
      return actual.any? { |a| evaluate_single(a, operator, expected) }
    end

    evaluate_single(actual, operator, expected)
  end

  def self.evaluate_single(actual, operator, expected)
    case operator
    when "IN"
      Array(expected).any? { |e| e.to_s.casecmp(actual.to_s).zero? }
    when "NOT_IN"
      Array(expected).none? { |e| e.to_s.casecmp(actual.to_s).zero? }
    when "==", "MUST_BE"
      a, e = coerce(actual), coerce(expected)
      a.is_a?(String) && e.is_a?(String) ? a.casecmp(e).zero? : a == e
    when "!="
      a, e = coerce(actual), coerce(expected)
      a.is_a?(String) && e.is_a?(String) ? !a.casecmp(e).zero? : a != e
    when "CONTAINS"
      actual.to_s.downcase.include?(expected.to_s.downcase)
    else
      false
    end
  end

  # Maps a dotted field name to an actual value from the context.
  #
  # resource.type resolves to BOTH name and category — the IN operator
  # checks if the value list contains either one, so users can write
  # IF resource.type IN ["sqs"] or IF resource.type IN ["database"].
  def self.resolve_field(field, module_definition, zone)
    case field
    when "resource.type"
      # Return an array so evaluate_condition can match against name OR category
      [module_definition.name, module_definition.category]
    when "resource.category"
      module_definition.category
    when "resource.subnet_type"
      zone
    when "resource.encryption"
      # Default to false — real value would come from config
      false
    when "resource.stateful"
      %w[database storage].include?(module_definition.category)
    when "resource.multi_az"
      false
    when "resource.public_access"
      zone == "public"
    when "module.name"
      module_definition.name
    when "env.type", "env.region"
      # Environment context not available at placement time — skip
      nil
    else
      nil
    end
  end

  def self.coerce(val)
    return true if val == "true" || val == true
    return false if val == "false" || val == false
    val
  end

  # ── Legacy format ──────────────────────────────────
  def self.violates_legacy_rule?(conditions, module_definition, zone)
    matches_module_legacy?(conditions, module_definition) && conditions["restricted_zone"] == zone
  end

  def self.matches_module_legacy?(conditions, module_definition)
    return true if conditions["categories"]&.include?(module_definition.category)
    return true if conditions["module_names"]&.include?(module_definition.name)
    false
  end

  private_class_method :applicable_rules, :violates_rule?, :violates_structured_rule?,
                       :violates_legacy_rule?, :evaluate_condition, :evaluate_single,
                       :resolve_field, :coerce, :matches_module_legacy?
end
