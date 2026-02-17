# frozen_string_literal: true

class ApplicationGroup < ApplicationRecord
  belongs_to :local_environment
  has_many :resources, dependent: :nullify

  validates :name, presence: true, uniqueness: { scope: :local_environment_id }
  validates :color, presence: true
end
