# frozen_string_literal: true

class RemoveRegionFromLocalEnvironments < ActiveRecord::Migration[7.1]
  def change
    remove_column :local_environments, :region, :string
  end
end
