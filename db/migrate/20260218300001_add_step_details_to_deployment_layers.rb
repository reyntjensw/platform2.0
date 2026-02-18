# frozen_string_literal: true

class AddStepDetailsToDeploymentLayers < ActiveRecord::Migration[8.0]
  def change
    add_column :deployment_layers, :step_details, :jsonb, default: [], null: false
  end
end
