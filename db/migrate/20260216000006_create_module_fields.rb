# frozen_string_literal: true

class CreateModuleFields < ActiveRecord::Migration[8.0]
  def change
    create_table :module_fields, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :module_definition, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.string :label, null: false
      t.string :field_type, null: false, default: "string"
      t.string :classification, null: false, default: "user_config"
      t.boolean :required, default: false
      t.jsonb :default_value
      t.jsonb :defaults_by_env
      t.jsonb :validation, default: {}
      t.string :group
      t.integer :position, default: 0
      t.jsonb :locked_in_envs, default: {}
      t.jsonb :dependency_config
      t.string :platform_source
      t.timestamps
    end

    add_index :module_fields, [:module_definition_id, :name], unique: true
    add_index :module_fields, :classification
  end
end
