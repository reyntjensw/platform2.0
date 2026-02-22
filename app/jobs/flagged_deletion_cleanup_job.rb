# frozen_string_literal: true

# Permanently deletes Local* records that have been flagged for deletion
# for more than 14 days. Runs bottom-up (environments → projects →
# customers → resellers) to respect foreign key constraints.
class FlaggedDeletionCleanupJob < ApplicationJob
  queue_as :default

  RETENTION_PERIOD = 14.days

  def perform
    cutoff = RETENTION_PERIOD.ago

    destroyed = { environments: 0, projects: 0, customers: 0, resellers: 0 }

    LocalEnvironment.flagged_for_deletion.where(flagged_for_deletion_at: ..cutoff).find_each do |env|
      env.destroy!
      destroyed[:environments] += 1
    end

    LocalProject.flagged_for_deletion.where(flagged_for_deletion_at: ..cutoff).find_each do |proj|
      next if proj.local_environments.active.exists?
      proj.destroy!
      destroyed[:projects] += 1
    end

    LocalCustomer.flagged_for_deletion.where(flagged_for_deletion_at: ..cutoff).find_each do |cust|
      next if cust.local_projects.active.exists?
      cust.destroy!
      destroyed[:customers] += 1
    end

    LocalReseller.flagged_for_deletion.where(flagged_for_deletion_at: ..cutoff).find_each do |res|
      next if res.local_customers.active.exists?
      res.destroy!
      destroyed[:resellers] += 1
    end

    Rails.logger.info("[FlaggedDeletionCleanup] Purged: #{destroyed.inspect}")
  end
end
