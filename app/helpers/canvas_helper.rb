# frozen_string_literal: true

module CanvasHelper
  def field_partial(field)
    case field.field_type
    when "boolean" then "toggle_field"
    when "enum" then "select_field"
    when "integer" then "number_field"
    else "text_field"
    end
  end
end
