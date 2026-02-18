# frozen_string_literal: true

class AddProviderDependenciesToModuleDefinitions < ActiveRecord::Migration[8.0]
  def change
    add_column :module_definitions, :provider_dependencies, :jsonb, default: [], null: false
  end
end
