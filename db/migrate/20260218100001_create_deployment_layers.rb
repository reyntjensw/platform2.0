# frozen_string_literal: true

class CreateDeploymentLayers < ActiveRecord::Migration[8.0]
  def change
    create_table :deployment_layers, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :deployment, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.integer :index, null: false
      t.jsonb :resource_ids, default: [], null: false
      t.jsonb :required_providers, default: [], null: false
      t.jsonb :remote_state_refs, default: [], null: false
      t.string :state_key, null: false
      t.string :status, default: "pending", null: false
      t.uuid :job_id
      t.text :plan_output
      t.jsonb :cost_estimate, default: {}
      t.text :error_details
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps
    end

    add_index :deployment_layers, [:deployment_id, :index], unique: true
    add_index :deployment_layers, :status
    add_index :deployment_layers, :job_id
  end
end
