# frozen_string_literal: true

class WidgetFilter < ApplicationRecord
  belongs_to :widget

  validates :filter_type, presence: true
  validates :filter_value, presence: true
end
