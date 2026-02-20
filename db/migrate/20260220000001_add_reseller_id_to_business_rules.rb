# frozen_string_literal: true

class AddResellerIdToBusinessRules < ActiveRecord::Migration[8.0]
  def change
    add_column :business_rules, :reseller_id, :uuid, null: true
    add_index :business_rules, :reseller_id
  end
end
