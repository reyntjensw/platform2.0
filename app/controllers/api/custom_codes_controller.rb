# frozen_string_literal: true

module Api
  class CustomCodesController < BaseController
    before_action :require_platform_admin, only: [:update]

    # GET /api/environments/:environment_id/custom_code
    def show
      record = @environment.canvas_custom_code
      if record
        render json: { code: record.code, language: record.language, updated_at: record.updated_at }
      else
        render json: { code: "", language: "hcl", updated_at: nil }
      end
    end

    # PUT /api/environments/:environment_id/custom_code
    def update
      record = @environment.canvas_custom_code || @environment.build_canvas_custom_code

      record.code = params[:code] || ""
      record.language = params[:language] || "hcl"
      record.validation_result = params[:validation_result] || {}

      if record.save
        AuditLogService.record(
          action: "updated", resource_type: "CanvasCustomCode",
          resource_uuid: record.id.to_s,
          metadata: { environment: @environment.name, language: record.language, code_length: record.code.length }
        )
        render json: { code: record.code, language: record.language, updated_at: record.updated_at }
      else
        render_error(record.errors.full_messages.join(", "))
      end
    end
  end
end
