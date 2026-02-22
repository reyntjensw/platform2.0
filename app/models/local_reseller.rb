# frozen_string_literal: true

class LocalReseller < ApplicationRecord
  has_many :local_customers, dependent: :destroy
  has_many :global_tags, as: :taggable, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true

  scope :active, -> { where(flagged_for_deletion_at: nil) }
  scope :flagged_for_deletion, -> { where.not(flagged_for_deletion_at: nil) }
  scope :deletion_due, -> { flagged_for_deletion.where(flagged_for_deletion_at: ..14.days.ago) }

  before_validation :generate_slug, if: -> { slug.blank? && name.present? }

  def flagged_for_deletion? = flagged_for_deletion_at.present?

  private

  def generate_slug
    self.slug = name.parameterize
  end
end
