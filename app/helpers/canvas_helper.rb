# frozen_string_literal: true

module CanvasHelper
  def field_partial(field)
    # Data-source fields get a dynamic select (or multi-select for list types)
    if field.data_source.present?
      return field.field_type == "list" ? "dynamic_multi_select_field" : "dynamic_select_field"
    end

    case field.field_type
    when "boolean" then "toggle_field"
    when "enum" then "select_field"
    when "integer" then "number_field"
    else "text_field"
    end
  end

  # Resolve dynamic options for a data-source field.
  # Called from the properties partial when rendering fields.
  def resolve_field_options(field, environment)
    return [] unless field.data_source.present? && environment

    DataSourceResolver.resolve(field.data_source, environment: environment)
  end
end
