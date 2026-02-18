# frozen_string_literal: true

class CreateCanvasLocks < ActiveRecord::Migration[7.1]
  def change
    create_table :canvas_locks do |t|
      t.references :environment, type: :uuid, null: false, foreign_key: { to_table: :local_environments }, index: { unique: true }
      t.string :device_id, null: false
      t.string :user_email, null: false
      t.string :user_name
      t.datetime :locked_at, null: false
      t.datetime :expires_at, null: false

      t.timestamps
    end
  end
end
