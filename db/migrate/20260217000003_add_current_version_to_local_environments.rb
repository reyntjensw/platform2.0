# frozen_string_literal: true

class AddCurrentVersionToLocalEnvironments < ActiveRecord::Migration[8.0]
  def change
    add_column :local_environments, :current_version, :string, default: "0.0.0"
  end
end
