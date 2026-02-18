# frozen_string_literal: true

module Api
  class PromotionsController < BaseController
    skip_before_action :set_environment
    before_action :set_project
    before_action :set_promotion_record, only: [:approve, :reject]

    # GET /api/projects/:project_id/promotions/pipeline
    def pipeline
      environments = @project.local_environments
        .where(env_type: %w[dev acc prd])
        .includes(:environment_snapshots, :deployments)
        .order(Arel.sql("CASE env_type WHEN 'dev' THEN 0 WHEN 'acc' THEN 1 WHEN 'prd' THEN 2 ELSE 3 END"))

      env_data = environments.map { |env| serialize_pipeline_env(env) }

      render_json({ environments: env_data })
    end

    # GET /api/projects/:project_id/promotions/diff
    def diff
      source_env = @project.local_environments.find(params[:source_env_id])
      target_env = @project.local_environments.find(params[:target_env_id])

      source_service = SnapshotService.new(source_env)
      source_snapshot = source_service.latest_snapshot
      source_snapshot ||= source_service.capture!(user_uuid: current_user.uuid)

      target_service = SnapshotService.new(target_env)
      target_snapshot = target_service.latest_snapshot

      diff_report = DiffService.new(
        source_snapshot,
        target_snapshot,
        app_group_id: params[:app_group_id]
      ).compute

      render_json(diff_report)
    end

    # POST /api/projects/:project_id/promotions/preview
    def preview
      source_env = @project.local_environments.find(params[:source_env_id])
      target_env = @project.local_environments.find(params[:target_env_id])

      service = PromotionService.new(source_env, target_env, user_uuid: current_user.uuid)
      plan_output = service.preview_plan(
        app_group_id: params[:app_group_id],
        excluded_resource_ids: params[:excluded_resource_ids] || []
      )

      render_json({ plan_output: plan_output })
    rescue PromotionService::PipelineError => e
      render_error(e.message, status: :service_unavailable)
    rescue PromotionService::InvalidDirectionError => e
      render_error(e.message, status: :unprocessable_entity)
    end

    # POST /api/projects/:project_id/promotions
    def create
      source_env = @project.local_environments.find(params[:source_env_id])
      target_env = @project.local_environments.find(params[:target_env_id])

      service = PromotionService.new(source_env, target_env, user_uuid: current_user.uuid)
      promotion_record = service.promote!(
        app_group_id: params[:app_group_id],
        excluded_resource_ids: params[:excluded_resource_ids] || []
      )

      render_json(serialize_promotion_record(promotion_record), status: :created)
    rescue PromotionService::InvalidDirectionError => e
      render_error(e.message, status: :unprocessable_entity)
    rescue PromotionService::ConcurrentPromotionError => e
      render json: { error: e.message }, status: :conflict
    end

    # PATCH /api/projects/:project_id/promotions/:id/approve
    def approve
      authorize!(:manage, @promotion_record.target_environment)

      service = PromotionService.new(
        @promotion_record.source_environment,
        @promotion_record.target_environment,
        user_uuid: current_user.uuid
      )
      service.approve!(@promotion_record, approver_uuid: current_user.uuid)

      render_json(serialize_promotion_record(@promotion_record.reload))
    rescue PromotionService::InvalidStatusError => e
      render_error(e.message, status: :unprocessable_entity)
    end

    # PATCH /api/projects/:project_id/promotions/:id/reject
    def reject
      authorize!(:manage, @promotion_record.target_environment)

      service = PromotionService.new(
        @promotion_record.source_environment,
        @promotion_record.target_environment,
        user_uuid: current_user.uuid
      )
      service.reject!(
        @promotion_record,
        approver_uuid: current_user.uuid,
        reason: params[:reason]
      )

      render_json(serialize_promotion_record(@promotion_record.reload))
    rescue PromotionService::InvalidStatusError => e
      render_error(e.message, status: :unprocessable_entity)
    end

    # GET /api/projects/:project_id/promotions/history
    def history
      records = PromotionRecord
        .where(source_environment_id: @project.local_environments.select(:id))
        .or(PromotionRecord.where(target_environment_id: @project.local_environments.select(:id)))
        .order(created_at: :desc)

      render_json(records.map { |r| serialize_promotion_record(r) })
    end

    private

    def set_project
      @project = LocalProject.find(params[:project_id])
    rescue ActiveRecord::RecordNotFound
      render_error("Project not found", status: :not_found)
    end

    def set_promotion_record
      @promotion_record = PromotionRecord.find(params[:id])
    rescue ActiveRecord::RecordNotFound
      render_error("Promotion record not found", status: :not_found)
    end

    def serialize_pipeline_env(env)
      latest_snapshot = env.environment_snapshots.latest.first
      last_deployment = env.deployments.where(status: "completed").order(created_at: :desc).first

      resource_summary = if latest_snapshot&.metadata
        latest_snapshot.metadata["category_summary"] || {}
      else
        # Fall back to live resource counts when no snapshot exists
        env.resources.includes(:module_definition)
           .group_by { |r| r.module_definition.category }
           .transform_values(&:size)
      end

      {
        id: env.id,
        name: env.name,
        env_type: env.env_type,
        version: latest_snapshot&.version || env.current_version,
        last_deployed_at: last_deployment&.created_at,
        resource_count: latest_snapshot&.resource_count || env.resources.size,
        resource_summary: resource_summary
      }
    end

    def serialize_promotion_record(record)
      {
        id: record.id,
        source_environment_id: record.source_environment_id,
        target_environment_id: record.target_environment_id,
        source_snapshot_id: record.source_snapshot_id,
        target_snapshot_id: record.target_snapshot_id,
        user_uuid: record.user_uuid,
        approver_uuid: record.approver_uuid,
        status: record.status,
        diff_summary: record.diff_summary,
        app_group_id: record.app_group_id,
        excluded_resource_ids: record.excluded_resource_ids,
        rejection_reason: record.rejection_reason,
        error_details: record.error_details,
        plan_output: record.plan_output,
        approved_at: record.approved_at,
        completed_at: record.completed_at,
        created_at: record.created_at,
        updated_at: record.updated_at
      }
    end
  end
end
