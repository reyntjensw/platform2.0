# frozen_string_literal: true

class ModuleOutput < ApplicationRecord
  belongs_to :module_definition

  validates :name, presence: true, uniqueness: { scope: :module_definition_id }
end
