# frozen_string_literal: true

class CanvasCustomCode < ApplicationRecord
  belongs_to :local_environment

  validates :language, presence: true, inclusion: { in: %w[hcl] }
end
