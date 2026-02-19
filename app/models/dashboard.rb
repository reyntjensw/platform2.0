# frozen_string_literal: true

class Dashboard < ApplicationRecord
  belongs_to :local_customer
  has_many :widgets, -> { order(:position) }, dependent: :destroy

  validates :name, presence: true, uniqueness: { scope: :local_customer_id }
end
