# frozen_string_literal: true

class LocalReseller < ApplicationRecord
  has_many :local_customers, dependent: :destroy
  has_many :global_tags, as: :taggable, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true

  before_validation :generate_slug, if: -> { slug.blank? && name.present? }

  private

  def generate_slug
    self.slug = name.parameterize
  end
end
