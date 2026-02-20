# frozen_string_literal: true

class AddDataSourceToModuleFields < ActiveRecord::Migration[8.0]
  def change
    add_column :module_fields, :data_source, :string
  end
end
