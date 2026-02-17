class CreateAuditLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :audit_logs, id: :uuid, default: "gen_random_uuid()" do |t|
      t.uuid   :user_uuid, null: false
      t.uuid   :reseller_uuid, null: false
      t.string :action, null: false
      t.string :resource_type, null: false
      t.uuid   :resource_uuid
      t.jsonb  :changes, default: {}
      t.jsonb  :metadata, default: {}
      t.timestamps
    end

    add_index :audit_logs, :user_uuid
    add_index :audit_logs, :reseller_uuid
    add_index :audit_logs, [:resource_type, :resource_uuid]
    add_index :audit_logs, :created_at
  end
end
