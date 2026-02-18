# frozen_string_literal: true

class PromotionExpirationJob < ApplicationJob
  queue_as :default

  EXPIRATION_THRESHOLD = 72.hours

  def perform
    PromotionRecord
      .awaiting_approval
      .where("created_at < ?", EXPIRATION_THRESHOLD.ago)
      .find_each do |record|
        record.update!(status: "expired")
      end
  end
end
