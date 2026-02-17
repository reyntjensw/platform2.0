# frozen_string_literal: true

class CreateBusinessRules < ActiveRecord::Migration[8.0]
  def change
    create_table :business_rules, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :customer_id, null: true
      t.string :name, null: false
      t.text :description
      t.string :severity, null: false, default: "warn"
      t.string :rule_type
      t.string :scope_type, null: false, default: "platform"
      t.jsonb :conditions, null: false, default: {}
      t.jsonb :actions, default: {}
      t.boolean :enabled, null: false, default: true
      t.string :cloud_provider, null: false
      t.timestamps
    end

    add_index :business_rules, [:name, :scope_type], unique: true
    add_index :business_rules, :scope_type
    add_index :business_rules, :cloud_provider
    add_index :business_rules, :enabled
    add_index :business_rules, :customer_id
  end
end
