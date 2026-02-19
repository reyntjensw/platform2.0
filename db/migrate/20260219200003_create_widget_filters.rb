# frozen_string_literal: true

class CreateWidgetFilters < ActiveRecord::Migration[8.0]
  def change
    create_table :widget_filters, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :widget, type: :uuid, null: false, foreign_key: true
      t.string :filter_type, null: false
      t.string :filter_value, null: false
      t.timestamps
    end
  end
end
