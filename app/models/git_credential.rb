# frozen_string_literal: true

class GitCredential < ApplicationRecord
  CREDENTIAL_TYPES = %w[personal_access_token project_token group_token deploy_token ssh_key].freeze

  belongs_to :owner, polymorphic: true
  has_many :module_renderers, dependent: :nullify

  encrypts :token
  encrypts :ssh_private_key

  validates :name, presence: true
  validates :host, presence: true
  validates :credential_type, presence: true, inclusion: { in: CREDENTIAL_TYPES }

  scope :active, -> { where(active: true) }
end
