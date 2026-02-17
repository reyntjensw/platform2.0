# frozen_string_literal: true

class CreateModuleImportDrafts < ActiveRecord::Migration[8.0]
  def change
    create_table :module_import_drafts, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :owner_type
      t.uuid :owner_id
      t.string :user_uuid, null: false
      t.integer :current_step, default: 1
      t.string :import_method, default: "git_url"
      t.string :source_url
      t.string :source_ref
      t.string :source_subpath
      t.string :engine, default: "opentofu"
      t.string :cloud_provider
      t.references :git_credential, type: :uuid, foreign_key: true
      t.jsonb :scan_result, default: {}
      t.jsonb :classifications, default: {}
      t.jsonb :field_configs, default: {}
      t.jsonb :metadata, default: {}
      t.string :status, default: "in_progress"
      t.string :registry_namespace
      t.string :registry_name
      t.string :registry_provider
      t.timestamps
    end

    add_index :module_import_drafts, [:owner_type, :owner_id]
    add_index :module_import_drafts, :user_uuid
    add_index :module_import_drafts, :status
  end
end
