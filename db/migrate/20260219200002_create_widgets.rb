# frozen_string_literal: true

class CreateWidgets < ActiveRecord::Migration[8.0]
  def change
    create_table :widgets, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :dashboard, type: :uuid, null: false, foreign_key: true
      t.string :chart_type, null: false
      t.string :title, null: false
      t.integer :position, default: 0
      t.boolean :is_saved, default: false
      t.boolean :is_expanded, default: false
      t.jsonb :query_config, default: {}
      t.jsonb :display_config, default: {}
      t.timestamps
    end
  end
end
