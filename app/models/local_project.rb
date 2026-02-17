# frozen_string_literal: true

class LocalProject < ApplicationRecord
  CLOUD_PROVIDERS = %w[aws azure gcp].freeze

  belongs_to :local_customer
  has_many :local_environments, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true
  validates :cloud_provider, presence: true, inclusion: { in: CLOUD_PROVIDERS }

  before_validation :generate_slug, if: -> { slug.blank? && name.present? }

  private

  def generate_slug
    self.slug = name.parameterize
  end
end
