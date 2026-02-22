# frozen_string_literal: true

module Api
  class BusinessRulesController < BaseController
    # GET /api/environments/:environment_id/business_rules
    def index
      rules = BusinessRule.enabled.for_cloud_provider(@environment.cloud_provider)
      customer = @environment.local_project&.local_customer
      reseller = customer&.local_reseller

      rules = if customer
        base = rules.platform_rules
        base = base.or(BusinessRule.reseller_rules(reseller.id)) if reseller
        base = base.or(BusinessRule.customer_rules(customer.id))
        base
      else
        rules.platform_rules
      end

      render json: rules.map { |r| serialize_rule(r) }
    end

    # PATCH /api/environments/:environment_id/business_rules/:id
    def update
      rule = BusinessRule.find(params[:id])

      # Support both simple toggle (enabled only) and full rule edit
      update_params = if params[:business_rule].present?
        business_rule_params
      else
        { enabled: params[:enabled] }
      end

      if rule.update(update_params)
        AuditLogService.record(
          action: "updated", resource_type: "BusinessRule",
          resource_uuid: rule.id.to_s,
          metadata: { name: rule.name, scope: rule.scope_type }
        )
        render json: serialize_rule(rule)
      else
        render_error(rule.errors.full_messages.join(", "))
      end
    end

    # POST /api/environments/:environment_id/business_rules
    def create
      rule = BusinessRule.new(business_rule_params)
      rule.cloud_provider ||= @environment.cloud_provider

      # Enforce scope restrictions based on user role
      if rule.scope_type == "platform" && !current_user&.platform_admin?
        return render json: { error: "Only platform admins can create platform-scoped rules" }, status: :forbidden
      end
      if rule.scope_type == "reseller" && !(current_user&.platform_admin? || current_user&.reseller_admin?)
        return render json: { error: "Only platform or reseller admins can create reseller-scoped rules" }, status: :forbidden
      end

      if rule.save
        AuditLogService.record(
          action: "created", resource_type: "BusinessRule",
          resource_uuid: rule.id.to_s,
          metadata: { name: rule.name, scope: rule.scope_type }
        )
        render json: serialize_rule(rule), status: :created
      else
        render_error(rule.errors.full_messages.join(", "))
      end
    end

    # DELETE /api/environments/:environment_id/business_rules/:id
    def destroy
      rule = BusinessRule.find(params[:id])
      name = rule.name
      rule.destroy!
      AuditLogService.record(
        action: "deleted", resource_type: "BusinessRule",
        resource_uuid: params[:id].to_s,
        metadata: { name: name }
      )
      render json: { message: "Rule deleted" }, status: :ok
    rescue ActiveRecord::RecordNotFound
      render json: { error: "Rule not found" }, status: :not_found
    end


    private

    def serialize_rule(rule)
      {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        rule_type: rule.rule_type,
        conditions: rule.conditions,
        actions: rule.actions,
        enabled: rule.enabled,
        cloud_provider: rule.cloud_provider,
        scope_type: rule.scope_type,
        customer_id: rule.customer_id,
        reseller_id: rule.reseller_id
      }
    end

    def business_rule_params
      raw = params.require(:business_rule)
      permitted = raw.permit(
        :name, :description, :severity, :rule_type,
        :scope_type, :cloud_provider, :customer_id, :reseller_id,
        conditions: {},
        actions: {}
      )
      # Deep-permit nested structures that Rails strong params can't express
      permitted[:conditions] = raw[:conditions].to_unsafe_h if raw.key?(:conditions)
      permitted[:actions] = raw[:actions].to_unsafe_h if raw.key?(:actions)
      permitted
    end

  end
end
