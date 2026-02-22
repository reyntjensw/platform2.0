# frozen_string_literal: true

class CreateCanvasCustomCodes < ActiveRecord::Migration[8.0]
  def change
    create_table :canvas_custom_codes, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :local_environment, type: :uuid, null: false, foreign_key: true, index: { unique: true }
      t.text :code, default: "", null: false
      t.string :language, default: "hcl", null: false
      t.jsonb :validation_result, default: {}
      t.timestamps
    end
  end
end
