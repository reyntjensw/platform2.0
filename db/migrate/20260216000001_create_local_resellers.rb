# frozen_string_literal: true

class CreateLocalResellers < ActiveRecord::Migration[8.0]
  def change
    create_table :local_resellers, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.jsonb :config, default: {}
      t.string :keycloak_group_path
      t.datetime :synced_at
      t.timestamps
    end

    add_index :local_resellers, :slug, unique: true
  end
end
