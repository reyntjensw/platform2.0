# frozen_string_literal: true

class AuditLogsController < AuthenticatedController
  before_action :require_platform_admin

  # GET /audit_logs
  def index
    @logs = AuditLog.recent.limit(500)

    # Filters
    @logs = @logs.where(action: params[:action_filter]) if params[:action_filter].present?
    @logs = @logs.where(resource_type: params[:resource_type]) if params[:resource_type].present?
    @logs = @logs.where(reseller_uuid: params[:reseller_uuid]) if params[:reseller_uuid].present?

    if params[:user_search].present?
      term = "%#{params[:user_search]}%"
      @logs = @logs.where(
        "metadata->>'user_name' ILIKE :term OR metadata->>'user_email' ILIKE :term",
        term: term
      )
    end

    if params[:customer_uuid].present?
      @logs = @logs.where("metadata->>'customer_uuid' = ?", params[:customer_uuid])
    end

    @available_actions = AuditLog::ACTIONS
    @available_resource_types = AuditLog.distinct.pluck(:resource_type).sort
    @customers = LocalCustomer.active.order(:name)
  end
end
