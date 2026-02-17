# frozen_string_literal: true

class ModuleImportDraft < ApplicationRecord
  STEPS = (1..6).to_a.freeze
  IMPORT_METHODS = %w[git_url registry upload].freeze
  STATUSES = %w[in_progress completed cancelled].freeze

  belongs_to :owner, polymorphic: true, optional: true
  belongs_to :git_credential, optional: true

  validates :user_uuid, presence: true
  validates :current_step, inclusion: { in: STEPS }
  validates :import_method, inclusion: { in: IMPORT_METHODS }
  validates :status, inclusion: { in: STATUSES }

  scope :in_progress, -> { where(status: "in_progress") }
  scope :for_user, ->(uuid) { where(user_uuid: uuid) }

  def step_name
    case current_step
    when 1 then "source"
    when 2 then "auth"
    when 3 then "scan"
    when 4 then "classify"
    when 5 then "configure"
    when 6 then "metadata"
    end
  end

  def needs_auth?
    import_method == "git_url" && source_url.present? && !public_repo?
  end

  def public_repo?
    # Registry imports and uploads don't need auth
    return true if import_method != "git_url"
    # If we already verified without credentials, it's public
    scan_result&.dig("public") == true
  end

  def variables
    scan_result&.dig("variables") || []
  end

  def outputs
    scan_result&.dig("outputs") || []
  end
end
