# frozen_string_literal: true

class CreateApplicationGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :application_groups, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_environment, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.string :color, null: false, default: "#3b82f6"
      t.timestamps
    end

    add_index :application_groups, [:local_environment_id, :name], unique: true
    add_reference :resources, :application_group, type: :uuid, foreign_key: true, null: true
  end
end
