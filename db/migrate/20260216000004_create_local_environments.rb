# frozen_string_literal: true

class CreateLocalEnvironments < ActiveRecord::Migration[8.0]
  def change
    create_table :local_environments, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_project, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.string :env_type, null: false
      t.string :cloud_provider, null: false
      t.string :iac_engine, null: false, default: "opentofu"
      t.string :region
      t.string :aws_account_id
      t.string :aws_role_arn
      t.string :azure_subscription_id
      t.jsonb :config, default: {}
      t.string :deploy_status
      t.datetime :last_deployed_at
      t.datetime :synced_at
      t.timestamps
    end

    add_index :local_environments, :env_type
    add_index :local_environments, :cloud_provider
  end
end
