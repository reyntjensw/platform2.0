# frozen_string_literal: true

class CreateResources < ActiveRecord::Migration[8.0]
  def change
    create_table :resources, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_environment, type: :uuid, null: false, foreign_key: true
      t.references :module_definition, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.jsonb :config, default: {}
      t.string :zone, default: "private"
      t.jsonb :validation_errors, default: {}
      t.float :position_x, default: 100.0
      t.float :position_y, default: 100.0
      t.timestamps
    end

    add_index :resources, [:local_environment_id, :name], unique: true
  end
end
