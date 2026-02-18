# frozen_string_literal: true

class AddGcpProjectIdToLocalEnvironments < ActiveRecord::Migration[8.0]
  def change
    add_column :local_environments, :gcp_project_id, :string
  end
end
