# frozen_string_literal: true

class CreateGlobalTags < ActiveRecord::Migration[8.0]
  def change
    create_table :global_tags, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :key, null: false
      t.string :value, null: false
      t.text :description
      t.boolean :enabled, default: true, null: false
      t.timestamps
    end

    add_index :global_tags, :key, unique: true
    add_index :global_tags, :enabled
  end
end
