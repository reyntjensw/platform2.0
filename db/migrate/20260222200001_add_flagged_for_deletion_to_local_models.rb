# frozen_string_literal: true

class AddFlaggedForDeletionToLocalModels < ActiveRecord::Migration[8.0]
  def change
    add_column :local_resellers, :flagged_for_deletion_at, :datetime
    add_column :local_customers, :flagged_for_deletion_at, :datetime
    add_column :local_projects, :flagged_for_deletion_at, :datetime
    add_column :local_environments, :flagged_for_deletion_at, :datetime
  end
end
