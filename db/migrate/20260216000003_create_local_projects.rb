# frozen_string_literal: true

class CreateLocalProjects < ActiveRecord::Migration[8.0]
  def change
    create_table :local_projects, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_customer, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.string :slug, null: false
      t.string :cloud_provider, null: false
      t.string :default_region
      t.datetime :synced_at
      t.timestamps
    end

    add_index :local_projects, :slug
    add_index :local_projects, :cloud_provider
  end
end
