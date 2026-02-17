# frozen_string_literal: true

class AddAllowedZonesToModuleDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :module_definitions, :allowed_zones, :jsonb, default: ["public", "private"], null: false
  end
end
