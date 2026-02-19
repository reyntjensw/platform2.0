# frozen_string_literal: true

class LocalCustomer < ApplicationRecord
  belongs_to :local_reseller
  has_many :local_projects, dependent: :destroy
  has_many :dashboards, dependent: :destroy
  has_many :global_tags, as: :taggable, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true

  before_validation :generate_slug, if: -> { slug.blank? && name.present? }

  private

  def generate_slug
    self.slug = name.parameterize
  end
end
