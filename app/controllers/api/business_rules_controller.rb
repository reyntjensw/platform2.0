# frozen_string_literal: true

module Api
  class BusinessRulesController < BaseController
    # GET /api/environments/:environment_id/business_rules
    def index
      rules = BusinessRule.enabled.for_cloud_provider(@environment.cloud_provider)
      customer = @environment.local_project&.local_customer

      rules = if customer
        rules.platform_rules.or(BusinessRule.customer_rules(customer.id))
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
        render json: serialize_rule(rule)
      else
        render_error(rule.errors.full_messages.join(", "))
      end
    end

    # POST /api/environments/:environment_id/business_rules
    def create
      rule = BusinessRule.new(business_rule_params)
      rule.cloud_provider ||= @environment.cloud_provider

      if rule.save
        render json: serialize_rule(rule), status: :created
      else
        render_error(rule.errors.full_messages.join(", "))
      end
    end

    # DELETE /api/environments/:environment_id/business_rules/:id
    def destroy
      rule = BusinessRule.find(params[:id])
      rule.destroy!
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
        customer_id: rule.customer_id
      }
    end

    def business_rule_params
      raw = params.require(:business_rule)
      permitted = raw.permit(
        :name, :description, :severity, :rule_type,
        :scope_type, :cloud_provider, :customer_id
      )
      # conditions & actions contain nested arrays of hashes that
      # Rails strong params cannot express — extract from raw params
      permitted[:conditions] = raw[:conditions].to_unsafe_h if raw[:conditions].present?
      permitted[:actions] = raw[:actions].to_unsafe_h if raw[:actions].present?
      permitted
    end

  end
end
