# frozen_string_literal: true

class CreateModuleRenderers < ActiveRecord::Migration[8.0]
  def change
    create_table :module_renderers, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :module_definition, type: :uuid, null: false, foreign_key: true
      t.references :git_credential, type: :uuid, foreign_key: true
      t.string :engine, null: false, default: "opentofu"
      t.string :source_type, null: false
      t.string :source_url, null: false
      t.string :source_ref
      t.string :source_subpath
      t.jsonb :discovered_vars, default: {}
      t.jsonb :discovered_outputs, default: {}
      t.datetime :last_scanned_at
      t.string :scan_status, default: "pending"
      t.text :scan_error
      t.timestamps
    end

    add_index :module_renderers, [:module_definition_id, :engine], unique: true
  end
end
