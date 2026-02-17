# frozen_string_literal: true

class CreateDeployments < ActiveRecord::Migration[8.0]
  def change
    create_table :deployments, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_environment, type: :uuid, null: false, foreign_key: true
      t.uuid :triggered_by_uuid, null: false
      t.string :status, null: false, default: "pending"
      t.text :plan_output
      t.jsonb :result, default: {}
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps
    end

    add_index :deployments, :status
    add_index :deployments, :triggered_by_uuid
  end
end
