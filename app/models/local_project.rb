# frozen_string_literal: true

class LocalProject < ApplicationRecord
  CLOUD_PROVIDERS = %w[aws azure gcp].freeze

  belongs_to :local_customer
  has_many :local_environments, dependent: :destroy
  has_many :global_tags, as: :taggable, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true
  validates :cloud_provider, presence: true, inclusion: { in: CLOUD_PROVIDERS }

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
