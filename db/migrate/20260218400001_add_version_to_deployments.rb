# frozen_string_literal: true

class AddVersionToDeployments < ActiveRecord::Migration[8.0]
  def up
    add_column :deployments, :version, :integer

    # Backfill existing deployments with sequential versions per environment
    execute <<~SQL
      UPDATE deployments
      SET version = sub.row_num
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY local_environment_id ORDER BY created_at) AS row_num
        FROM deployments
      ) sub
      WHERE deployments.id = sub.id
    SQL

    change_column_null :deployments, :version, false, 1
    change_column_default :deployments, :version, 1
    add_index :deployments, [:local_environment_id, :version], unique: true
  end

  def down
    remove_index :deployments, [:local_environment_id, :version]
    remove_column :deployments, :version
  end
end
