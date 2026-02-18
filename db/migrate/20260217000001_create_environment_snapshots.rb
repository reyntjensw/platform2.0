# frozen_string_literal: true

class CreateEnvironmentSnapshots < ActiveRecord::Migration[8.0]
  def change
    create_table :environment_snapshots, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_environment, type: :uuid, null: false, foreign_key: true
      t.string :version, null: false
      t.jsonb :snapshot_data, null: false, default: {}
      t.integer :resource_count, null: false, default: 0
      t.jsonb :metadata, default: {}
      t.datetime :created_at, null: false
    end

    add_index :environment_snapshots, [:local_environment_id, :version], unique: true
    add_index :environment_snapshots, :created_at
  end
end
