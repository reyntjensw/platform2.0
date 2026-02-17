# frozen_string_literal: true

class CreateGitCredentials < ActiveRecord::Migration[8.0]
  def change
    create_table :git_credentials, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :owner_type, null: false
      t.uuid :owner_id, null: false
      t.string :name, null: false
      t.string :host, null: false
      t.string :credential_type, null: false
      t.text :token
      t.text :ssh_private_key
      t.string :scope, default: "read_repository"
      t.boolean :active, default: true
      t.datetime :last_verified_at
      t.datetime :expires_at
      t.timestamps
    end

    add_index :git_credentials, [:owner_type, :owner_id]
  end
end
