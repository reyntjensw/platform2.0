# frozen_string_literal: true

class CreatePromotionRecords < ActiveRecord::Migration[8.0]
  def change
    create_table :promotion_records, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :source_environment, type: :uuid, null: false, foreign_key: { to_table: :local_environments }
      t.references :target_environment, type: :uuid, null: false, foreign_key: { to_table: :local_environments }
      t.references :source_snapshot, type: :uuid, null: false, foreign_key: { to_table: :environment_snapshots }
      t.references :target_snapshot, type: :uuid, null: true, foreign_key: { to_table: :environment_snapshots }
      t.uuid :user_uuid, null: false
      t.uuid :approver_uuid
      t.string :status, null: false, default: "pending"
      t.jsonb :diff_summary, default: {}
      t.jsonb :diff_detail, default: {}
      t.text :plan_output
      t.jsonb :excluded_resource_ids, default: []
      t.uuid :app_group_id
      t.text :rejection_reason
      t.text :error_details
      t.datetime :approved_at
      t.datetime :completed_at
      t.timestamps
    end

    add_index :promotion_records, :status
    add_index :promotion_records, :user_uuid
    add_index :promotion_records, :app_group_id
  end
end
