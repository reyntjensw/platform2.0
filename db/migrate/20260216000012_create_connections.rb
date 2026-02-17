# frozen_string_literal: true

class CreateConnections < ActiveRecord::Migration[8.0]
  def change
    create_table :connections, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :from_resource, type: :uuid, null: false, foreign_key: { to_table: :resources, on_delete: :cascade }
      t.references :to_resource, type: :uuid, null: false, foreign_key: { to_table: :resources, on_delete: :cascade }
      t.string :connection_type, null: false, default: "dependency"
      t.timestamps
    end

    add_index :connections, [:from_resource_id, :to_resource_id], unique: true
  end
end
