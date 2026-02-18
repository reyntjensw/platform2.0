# frozen_string_literal: true

class AddLayerFieldsToDeployments < ActiveRecord::Migration[8.0]
  def change
    change_table :deployments, bulk: true do |t|
      t.integer :total_layers, default: 1
      t.integer :current_layer, default: 0
      t.jsonb :cost_estimate, default: {}
      t.uuid :approved_by_uuid
      t.datetime :approved_at
      t.string :approval_status
    end

    add_index :deployments, :approval_status
  end
end
