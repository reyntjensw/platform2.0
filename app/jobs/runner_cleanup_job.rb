# frozen_string_literal: true

class RunnerCleanupJob < ApplicationJob
  queue_as :default

  # Runs periodically to mark stale runners as offline
  # and delete runners that have been offline for over 1 hour.
  def perform
    RunnerStatusService.new.cleanup_stale_runners(max_offline_age: 1.hour)
  end
end
