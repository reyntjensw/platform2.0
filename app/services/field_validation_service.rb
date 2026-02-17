# frozen_string_literal: true

class FieldValidationService
  # Validates a config hash against a module definition's fields.
  # Returns a hash of { field_name => [error_messages] }
  def self.validate(module_definition, config)
    errors = {}

    module_definition.module_fields.user_config.each do |field|
      value = config[field.name]

      if field.required? && (value.nil? || value.to_s.strip.empty?)
        (errors[field.name] ||= []) << "is required"
        next
      end

      next if value.nil?

      validate_field(field, value, errors)
    end

    errors
  end

  def self.validate_field(field, value, errors)
    v = field.validation || {}

    case field.field_type
    when "integer"
      unless value.is_a?(Numeric)
        (errors[field.name] ||= []) << "must be a number"
        return
      end
      (errors[field.name] ||= []) << "must be at least #{v['min']}" if v["min"] && value < v["min"]
      (errors[field.name] ||= []) << "must be at most #{v['max']}" if v["max"] && value > v["max"]
      (errors[field.name] ||= []) << "must be one of #{v['allowed'].join(', ')}" if v["allowed"] && !v["allowed"].include?(value)
    when "enum"
      if v["allowed"] && !v["allowed"].include?(value.to_s)
        (errors[field.name] ||= []) << "must be one of #{v['allowed'].join(', ')}"
      end
    when "string"
      if v["regex"] && !value.to_s.match?(Regexp.new(v["regex"]))
        (errors[field.name] ||= []) << "does not match expected format"
      end
    when "boolean"
      unless [true, false].include?(value)
        (errors[field.name] ||= []) << "must be true or false"
      end
    end
  end

  private_class_method :validate_field
end
