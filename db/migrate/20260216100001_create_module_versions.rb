# frozen_string_literal: true

class CreateModuleVersions < ActiveRecord::Migration[8.0]
  def change
    create_table :module_versions, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :module_renderer, type: :uuid, null: false, foreign_key: true
      t.string :version_ref, null: false
      t.jsonb :discovered_vars, default: {}
      t.jsonb :discovered_outputs, default: {}
      t.boolean :breaking, default: false
      t.text :changelog
      t.jsonb :compatibility_report, default: {}
      t.datetime :scanned_at
      t.datetime :published_at
      t.timestamps
    end

    add_index :module_versions, [:module_renderer_id, :version_ref], unique: true

    # Add version pinning and upgrade tracking to resources
    add_column :resources, :renderer_ref, :string
    add_column :resources, :upgrade_available, :boolean, default: false
    add_column :resources, :upgrade_report, :jsonb, default: {}

    # Add upgrade policy to environments
    add_column :local_environments, :upgrade_policy, :string, default: "manual"
  end
end
