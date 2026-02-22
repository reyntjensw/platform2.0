# frozen_string_literal: true

module Api
  class ApplicationGroupsController < BaseController
    before_action :set_application_group, only: [:update, :destroy]

    # GET /api/environments/:environment_id/application_groups
    def index
      groups = @environment.application_groups.includes(:resources)
      render json: groups.map { |g| serialize_group(g) }
    end

    # POST /api/environments/:environment_id/application_groups
    def create
      group = @environment.application_groups.build(application_group_params)

      if group.save
        AuditLogService.record(
          action: "created", resource_type: "ApplicationGroup",
          resource_uuid: group.id.to_s,
          metadata: { name: group.name, environment: @environment.name }
        )
        render json: serialize_group(group), status: :created
      else
        render_error(group.errors.full_messages.join(", "))
      end
    end

    # PATCH /api/environments/:environment_id/application_groups/:id
    def update
      if @application_group.update(application_group_params)
        AuditLogService.record(
          action: "updated", resource_type: "ApplicationGroup",
          resource_uuid: @application_group.id.to_s,
          metadata: { name: @application_group.name, environment: @environment.name }
        )
        render json: serialize_group(@application_group)
      else
        render_error(@application_group.errors.full_messages.join(", "))
      end
    end

    # DELETE /api/environments/:environment_id/application_groups/:id
    def destroy
      name = @application_group.name
      @application_group.destroy!
      AuditLogService.record(
        action: "deleted", resource_type: "ApplicationGroup",
        resource_uuid: params[:id].to_s,
        metadata: { name: name, environment: @environment.name }
      )
      head :no_content
    end

    private

    def set_application_group
      @application_group = @environment.application_groups.find(params[:id])
    rescue ActiveRecord::RecordNotFound
      render_error("Application group not found", status: :not_found)
    end

    def application_group_params
      params.permit(:name, :color)
    end

    def serialize_group(group)
      {
        id: group.id,
        name: group.name,
        color: group.color,
        local_environment_id: group.local_environment_id,
        resource_ids: group.resources.pluck(:id),
        created_at: group.created_at,
        updated_at: group.updated_at
      }
    end
  end
end
