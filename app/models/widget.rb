# frozen_string_literal: true

class Widget < ApplicationRecord
  CHART_TYPES = %w[daily-spend service-breakdown storage-spend account-distribution top-services monthly-spend-trend].freeze

  belongs_to :dashboard
  has_many :widget_filters, dependent: :destroy

  validates :chart_type, presence: true, inclusion: { in: CHART_TYPES }
  validates :title, presence: true
end
