# frozen_string_literal: true

class CreateFieldMappings < ActiveRecord::Migration[8.0]
  def change
    create_table :field_mappings, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :module_renderer, type: :uuid, null: false, foreign_key: true
      t.string :platform_field, null: false
      t.string :renderer_variable, null: false
      t.string :mapping_type, null: false, default: "direct"
      t.string :transform
      t.string :dependency_syntax
      t.timestamps
    end

    add_index :field_mappings, [:module_renderer_id, :platform_field], unique: true
  end
end
