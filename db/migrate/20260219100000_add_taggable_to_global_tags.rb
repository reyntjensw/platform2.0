# frozen_string_literal: true

class AddTaggableToGlobalTags < ActiveRecord::Migration[8.0]
  def change
    add_column :global_tags, :taggable_type, :string
    add_column :global_tags, :taggable_id, :uuid

    # Remove the old unique index on key alone
    remove_index :global_tags, :key

    # Add a composite unique index: same key can exist at different scopes
    add_index :global_tags, [:key, :taggable_type, :taggable_id],
              unique: true, name: "index_global_tags_on_key_and_taggable"

    # Index for polymorphic lookups
    add_index :global_tags, [:taggable_type, :taggable_id],
              name: "index_global_tags_on_taggable"

    # Platform-level tags have NULL taggable — ensure unique keys there too
    add_index :global_tags, :key, unique: true,
              where: "taggable_type IS NULL AND taggable_id IS NULL",
              name: "index_global_tags_on_key_platform"
  end
end
