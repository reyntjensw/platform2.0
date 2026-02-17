# frozen_string_literal: true

class CreateModuleOutputs < ActiveRecord::Migration[8.0]
  def change
    create_table :module_outputs, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :module_definition, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.string :description
      t.string :output_type, default: "string"
      t.timestamps
    end

    add_index :module_outputs, [:module_definition_id, :name], unique: true
  end
end
