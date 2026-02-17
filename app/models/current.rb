# frozen_string_literal: true

class Current < ActiveSupport::CurrentAttributes
  attribute :user
  attribute :reseller
  attribute :customer
  attribute :project
  attribute :environment
end
