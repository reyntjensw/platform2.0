# frozen_string_literal: true

class AddExecutionModeToLocalEnvironments < ActiveRecord::Migration[8.0]
  def change
    add_column :local_environments, :execution_mode, :string, null: false, default: "platform"
  end
end
