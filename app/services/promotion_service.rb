# frozen_string_literal: true

class PromotionService
  PROMOTION_ORDER = { "dev" => "acc", "acc" => "prd" }.freeze

  class PromotionError < StandardError; end
  class InvalidDirectionError < PromotionError; end
  class ConcurrentPromotionError < PromotionError; end
  class InvalidStatusError < PromotionError; end
  class PipelineError < PromotionError; end

  def initialize(source_env, target_env, user_uuid:)
    @source_env = source_env
    @target_env = target_env
    @user_uuid = user_uuid
  end

  # Creates PromotionRecord, checks gates, executes or queues for approval
  def promote!(app_group_id: nil, excluded_resource_ids: [])
    validate_promotion_direction!
    guard_concurrent_promotion!

    source_snapshot = ensure_source_snapshot!
    target_snapshot = SnapshotService.new(@target_env).latest_snapshot

    diff_report = DiffService.new(source_snapshot, target_snapshot, app_group_id: app_group_id).compute

    initial_status = @target_env.env_type == "prd" ? "awaiting_approval" : "pending"

    promotion_record = PromotionRecord.create!(
      source_environment: @source_env,
      target_environment: @target_env,
      source_snapshot: source_snapshot,
      user_uuid: @user_uuid,
      status: initial_status,
      diff_summary: diff_report[:summary],
      diff_detail: diff_report,
      app_group_id: app_group_id,
      excluded_resource_ids: excluded_resource_ids.presence || []
    )

    if initial_status == "pending"
      execute_promotion!(promotion_record, diff_report)
    end

    promotion_record
  end

  # Generates preview plan via PipelineClient
  def preview_plan(app_group_id: nil, excluded_resource_ids: [])
    source_snapshot = ensure_source_snapshot!
    target_snapshot = SnapshotService.new(@target_env).latest_snapshot

    diff_report = DiffService.new(source_snapshot, target_snapshot, app_group_id: app_group_id).compute

    # Build a temporary post-promotion state and generate IR
    apply_diff_to_target_temporarily(diff_report, excluded_resource_ids) do
      deployment = @target_env.deployments.build(
        triggered_by_uuid: @user_uuid,
        status: "pending"
      )
      ir = ::IRBuilder.new(@target_env).build(deployment)
      result = ::PipelineClient.new.plan(ir)

      unless result[:success]
        raise PipelineError, result[:error] || "Pipeline service unreachable"
      end

      result[:data]
    end
  rescue Faraday::Error => e
    raise PipelineError, e.message
  end

  # Approves a pending promotion
  def approve!(promotion_record, approver_uuid:)
    unless promotion_record.status == "awaiting_approval"
      raise InvalidStatusError, "Cannot approve a promotion with status '#{promotion_record.status}'"
    end

    promotion_record.update!(
      status: "approved",
      approver_uuid: approver_uuid,
      approved_at: Time.current
    )

    execute_promotion!(promotion_record, promotion_record.diff_detail.deep_symbolize_keys)
    promotion_record
  end

  # Rejects a pending promotion
  def reject!(promotion_record, approver_uuid:, reason:)
    unless promotion_record.status == "awaiting_approval"
      raise InvalidStatusError, "Cannot reject a promotion with status '#{promotion_record.status}'"
    end

    promotion_record.update!(
      status: "rejected",
      approver_uuid: approver_uuid,
      rejection_reason: reason
    )

    promotion_record
  end

  def valid_promotion_direction?
    PROMOTION_ORDER[@source_env.env_type] == @target_env.env_type
  end

  private

  def validate_promotion_direction!
    unless valid_promotion_direction?
      raise InvalidDirectionError,
        "Cannot promote from #{@source_env.env_type} to #{@target_env.env_type}. " \
        "Allowed: dev→acc, acc→prd."
    end
  end

  def guard_concurrent_promotion!
    if PromotionRecord.in_progress.where(target_environment: @target_env).exists?
      raise ConcurrentPromotionError,
        "A promotion is already in progress for target environment '#{@target_env.name}'"
    end
  end

  def ensure_source_snapshot!
    snapshot_service = SnapshotService.new(@source_env)
    snapshot_service.latest_snapshot || snapshot_service.capture!(user_uuid: @user_uuid)
  end

  def execute_promotion!(promotion_record, diff_report)
    promotion_record.update!(status: "executing")

    excluded_ids = promotion_record.excluded_resource_ids || []
    app_group_id = promotion_record.app_group_id

    begin
      ActiveRecord::Base.transaction do
        # Process added resources
        (diff_report[:added] || diff_report["added"] || []).each do |entry|
          entry = entry.deep_symbolize_keys if entry.is_a?(Hash)
          next if excluded_ids.include?(entry[:resource_id])

          mod_def = ModuleDefinition.find_by(id: entry[:module_definition_id])
          next unless mod_def

          target_group = resolve_target_app_group(entry, app_group_id)

          config = apply_env_overrides(
            entry[:config] || {},
            mod_def,
            @target_env.env_type
          )

          @target_env.resources.create!(
            name: entry[:resource_name],
            module_definition: mod_def,
            config: config,
            zone: entry[:zone] || mod_def.allowed_zones.first,
            application_group: target_group
          )
        end

        # Process modified resources
        (diff_report[:modified] || diff_report["modified"] || []).each do |entry|
          entry = entry.deep_symbolize_keys if entry.is_a?(Hash)
          next if excluded_ids.include?(entry[:resource_id])

          target_resource = find_target_resource(entry)
          next unless target_resource

          changes = entry[:changes] || {}
          new_config = target_resource.config || {}

          changes.each do |field, change|
            change = change.deep_symbolize_keys if change.is_a?(Hash)
            next if field.to_s == "connections"
            new_config[field.to_s] = change[:to]
          end

          new_config = apply_env_overrides(
            new_config,
            target_resource.module_definition,
            @target_env.env_type,
            existing_config: target_resource.config
          )

          new_zone = changes.dig(:zone, :to) || changes.dig("zone", :to) || target_resource.zone
          target_resource.update!(config: new_config, zone: new_zone)
        end

        # Process removed resources
        (diff_report[:removed] || diff_report["removed"] || []).each do |entry|
          entry = entry.deep_symbolize_keys if entry.is_a?(Hash)
          next if excluded_ids.include?(entry[:resource_id])

          target_resource = find_target_resource(entry)
          target_resource&.destroy!
        end

        # Create target snapshot after promotion
        target_snapshot = SnapshotService.new(@target_env).capture!(
          user_uuid: promotion_record.user_uuid,
          version_bump: :patch
        )

        promotion_record.update!(
          status: "completed",
          target_snapshot: target_snapshot,
          completed_at: Time.current
        )
      end
    rescue => e
      promotion_record.update!(
        status: "failed",
        error_details: e.message
      )
      raise
    end
  end

  def apply_env_overrides(config, module_definition, target_env_type, existing_config: nil)
    overridden = config.dup

    module_definition.module_fields.each do |field|
      # Apply defaults_by_env for newly added resources (no existing config)
      env_default = field.defaults_by_env&.dig(target_env_type)
      if env_default.present? && existing_config.nil?
        overridden[field.name] = env_default
      end

      # Preserve locked_in_envs fields from existing target resource config
      locked_envs = field.locked_in_envs || {}
      if locked_envs[target_env_type].present? && existing_config.present?
        overridden[field.name] = existing_config[field.name] if existing_config.key?(field.name)
      end
    end

    overridden
  end

  def find_target_resource(entry)
    @target_env.resources
      .joins(:module_definition)
      .find_by(
        name: entry[:resource_name],
        module_definitions: { id: entry[:module_definition_id] }
      )
  end

  def resolve_target_app_group(entry, promotion_app_group_id)
    group_name = entry[:application_group_name]
    return nil if group_name.blank?

    # Find or create matching ApplicationGroup in target environment
    @target_env.application_groups.find_or_create_by!(name: group_name) do |group|
      # Try to get color from source group, fallback to a default
      source_group = ApplicationGroup.find_by(id: entry[:application_group_id])
      group.color = source_group&.color || "#6366f1"
    end
  end

  def apply_diff_to_target_temporarily(diff_report, excluded_resource_ids)
    # For preview, we don't actually modify the DB — we just reload after
    # This is a simplified approach: apply changes, yield, then rollback
    result = nil
    error = nil
    ActiveRecord::Base.transaction do
      excluded_ids = excluded_resource_ids || []

      (diff_report[:added] || []).each do |entry|
        entry = entry.deep_symbolize_keys if entry.is_a?(Hash)
        next if excluded_ids.include?(entry[:resource_id])

        mod_def = ModuleDefinition.find_by(id: entry[:module_definition_id])
        next unless mod_def

        config = apply_env_overrides(entry[:config] || {}, mod_def, @target_env.env_type)
        @target_env.resources.create!(
          name: entry[:resource_name],
          module_definition: mod_def,
          config: config,
          zone: entry[:zone] || mod_def.allowed_zones.first
        )
      end

      (diff_report[:modified] || []).each do |entry|
        entry = entry.deep_symbolize_keys if entry.is_a?(Hash)
        next if excluded_ids.include?(entry[:resource_id])

        target_resource = find_target_resource(entry)
        next unless target_resource

        changes = entry[:changes] || {}
        new_config = target_resource.config || {}
        changes.each do |field, change|
          change = change.deep_symbolize_keys if change.is_a?(Hash)
          next if field.to_s == "connections"
          new_config[field.to_s] = change[:to]
        end

        new_config = apply_env_overrides(new_config, target_resource.module_definition, @target_env.env_type, existing_config: target_resource.config)
        new_zone = changes.dig(:zone, :to) || changes.dig("zone", :to) || target_resource.zone
        target_resource.update!(config: new_config, zone: new_zone)
      end

      (diff_report[:removed] || []).each do |entry|
        entry = entry.deep_symbolize_keys if entry.is_a?(Hash)
        next if excluded_ids.include?(entry[:resource_id])
        find_target_resource(entry)&.destroy!
      end

      begin
        result = yield
      rescue => e
        error = e
      end

      raise ActiveRecord::Rollback
    end

    raise error if error

    result
  end
end
