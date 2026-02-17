# frozen_string_literal: true

class CreateLocalCustomers < ActiveRecord::Migration[8.0]
  def change
    create_table :local_customers, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_reseller, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.string :slug, null: false
      t.jsonb :config, default: {}
      t.string :keycloak_group_path
      t.datetime :synced_at
      t.timestamps
    end

    add_index :local_customers, :slug
  end
end
