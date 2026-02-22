# frozen_string_literal: true

# Syncs the Local* hierarchy (resellers → customers → projects → environments)
# from cs-internal-api. Records missing upstream are flagged for deletion rather
# than destroyed immediately — platform admins can still see them for 14 days.
class HierarchySyncJob < ApplicationJob
  queue_as :default

  def perform
    @client = CsInternalApiClient.new
    @now = Time.current

    sync_resellers
    Rails.logger.info("[HierarchySync] completed at #{@now}")
  end

  private

  def sync_resellers
    response = @client.list_resellers
    return log_error("resellers", response.error) unless response.success?

    upstream_slugs = []

    Array(response.data).each do |attrs|
      slug = attrs["uuid"] || attrs[:uuid]
      next unless slug

      upstream_slugs << slug.to_s
      reseller = LocalReseller.find_or_initialize_by(slug: slug.to_s)
      reseller.assign_attributes(name: attrs["name"] || attrs[:name])
      reseller.flagged_for_deletion_at = nil # unflag if it reappears
      reseller.synced_at = @now
      reseller.save!

      sync_customers(reseller)
    end

    flag_missing(LocalReseller, upstream_slugs)
  end

  def sync_customers(reseller)
    response = @client.list_customers(reseller_uuid: reseller.slug)
    return log_error("customers for #{reseller.slug}", response.error) unless response.success?

    upstream_slugs = []

    Array(response.data).each do |attrs|
      slug = attrs["uuid"] || attrs[:uuid]
      next unless slug

      upstream_slugs << slug.to_s
      customer = LocalCustomer.find_or_initialize_by(slug: slug.to_s, local_reseller: reseller)
      customer.assign_attributes(name: attrs["name"] || attrs[:name])
      customer.flagged_for_deletion_at = nil
      customer.synced_at = @now
      customer.save!

      sync_projects(customer, reseller)
    end

    flag_missing(reseller.local_customers, upstream_slugs)
  end

  def sync_projects(customer, reseller)
    response = @client.list_customer_projects(
      customer_uuid: customer.slug,
      reseller_uuid: reseller.slug
    )
    return log_error("projects for #{customer.slug}", response.error) unless response.success?

    upstream_slugs = []

    Array(response.data).each do |attrs|
      slug = attrs["uuid"] || attrs[:uuid]
      next unless slug

      upstream_slugs << slug.to_s
      project = LocalProject.find_or_initialize_by(slug: slug.to_s, local_customer: customer)
      project.assign_attributes(
        name: attrs["name"] || attrs[:name],
        cloud_provider: (attrs["provider"] || attrs[:provider] || "aws").downcase,
        default_region: attrs["region"] || attrs[:region] || project.default_region
      )
      project.flagged_for_deletion_at = nil
      project.synced_at = @now
      project.save!

      sync_environments(project)
    end

    flag_missing(customer.local_projects, upstream_slugs)
  end

  def sync_environments(project)
    response = @client.list_environments(project_uuid: project.slug)
    return log_error("environments for #{project.slug}", response.error) unless response.success?

    upstream_slugs = []

    Array(response.data).each do |attrs|
      slug = attrs["uuid"] || attrs[:uuid]
      next unless slug

      upstream_slugs << slug.to_s
      env = LocalEnvironment.find_or_initialize_by(
        name: attrs["name"] || attrs[:name],
        local_project: project
      )
      env.assign_attributes(
        env_type: (attrs["env_type"] || attrs[:env_type] || "dev").downcase,
        cloud_provider: project.cloud_provider,
        aws_account_id: attrs["aws_account_id"] || attrs[:aws_account_id] || env.aws_account_id,
        azure_subscription_id: attrs["azure_subscription_id"] || attrs[:azure_subscription_id] || env.azure_subscription_id
      )
      env.flagged_for_deletion_at = nil
      env.synced_at = @now
      env.save!
    end

    # For environments we match on name+project rather than slug,
    # so flag any that weren't touched this sync cycle
    project.local_environments
      .where(flagged_for_deletion_at: nil)
      .where.not(synced_at: @now)
      .where.not(synced_at: nil)
      .update_all(flagged_for_deletion_at: @now)
  end

  # Flag records whose slug is no longer present upstream.
  # Accepts a model class or an ActiveRecord relation.
  def flag_missing(scope, upstream_slugs)
    scope = scope.where.not(slug: upstream_slugs) if upstream_slugs.any?
    scope = scope.where(flagged_for_deletion_at: nil)
    scope.update_all(flagged_for_deletion_at: @now)
  end

  def log_error(context, error)
    Rails.logger.error("[HierarchySync] Failed to fetch #{context}: #{error}")
  end
end
