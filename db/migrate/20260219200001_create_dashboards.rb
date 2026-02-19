# frozen_string_literal: true

class CreateDashboards < ActiveRecord::Migration[8.0]
  def change
    create_table :dashboards, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_customer, type: :uuid, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      t.boolean :is_default, default: false
      t.jsonb :layout_config, default: {}
      t.timestamps
    end

    add_index :dashboards, [:local_customer_id, :name], unique: true
  end
end
