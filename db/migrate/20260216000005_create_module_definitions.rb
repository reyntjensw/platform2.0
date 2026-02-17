# frozen_string_literal: true

class CreateModuleDefinitions < ActiveRecord::Migration[8.0]
  def change
    create_table :module_definitions, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :owner_type
      t.uuid :owner_id
      t.string :name, null: false
      t.string :display_name, null: false
      t.text :description
      t.string :version, default: "1.0.0"
      t.string :status, null: false, default: "draft"
      t.string :cloud_provider, null: false
      t.string :category, null: false
      t.string :icon
      t.string :ownership, null: false, default: "platform"
      t.string :visibility, null: false, default: "global"
      t.jsonb :constraints, default: {}
      t.jsonb :supported_engines, default: []
      t.timestamps
    end

    add_index :module_definitions, [:owner_type, :owner_id]
    add_index :module_definitions, [:name, :cloud_provider], unique: true
    add_index :module_definitions, :cloud_provider
    add_index :module_definitions, :category
    add_index :module_definitions, :status
    add_index :module_definitions, :visibility
  end
end
