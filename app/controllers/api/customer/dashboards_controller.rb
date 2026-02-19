# frozen_string_literal: true

module Api
  module Customer
    class DashboardsController < BaseController
      before_action :set_dashboard, only: [:show, :update, :destroy, :reorder]

      # GET /customers/:customer_uuid/api/dashboards
      def index
        dashboards = @local_customer.dashboards
                                     .includes(widgets: :widget_filters)
                                     .order(:created_at)

        render_json(dashboards.as_json(include: { widgets: { include: :widget_filters } }))
      end

      # GET /customers/:customer_uuid/api/dashboards/:id
      def show
        render_json(@dashboard.as_json(include: { widgets: { include: :widget_filters } }))
      end

      # POST /customers/:customer_uuid/api/dashboards
      def create
        dashboard = @local_customer.dashboards.new(dashboard_params)
        dashboard.is_default = true if @local_customer.dashboards.empty?

        if dashboard.save
          render_json(
            dashboard.as_json(include: { widgets: { include: :widget_filters } }),
            status: :created
          )
        else
          render_error(dashboard.errors.full_messages, status: :unprocessable_entity)
        end
      end

      # PATCH /customers/:customer_uuid/api/dashboards/:id
      def update
        if @dashboard.update(dashboard_params)
          render_json(@dashboard.as_json(include: { widgets: { include: :widget_filters } }))
        else
          render_error(@dashboard.errors.full_messages, status: :unprocessable_entity)
        end
      end

      # DELETE /customers/:customer_uuid/api/dashboards/:id
      def destroy
        @dashboard.destroy!
        head :no_content
      end

      # PATCH /customers/:customer_uuid/api/dashboards/:id/reorder
      def reorder
        widget_ids = params[:widget_ids]

        unless widget_ids.is_a?(Array)
          return render_error("widget_ids must be an array", status: :unprocessable_entity)
        end

        dashboard_widget_ids = @dashboard.widgets.pluck(:id)
        unless widget_ids.sort == dashboard_widget_ids.sort
          return render_error(
            "widget_ids must contain exactly the widgets belonging to this dashboard",
            status: :unprocessable_entity
          )
        end

        ActiveRecord::Base.transaction do
          widget_ids.each_with_index do |widget_id, index|
            @dashboard.widgets.find(widget_id).update!(position: index)
          end
        end

        render_json(@dashboard.reload.as_json(include: { widgets: { include: :widget_filters } }))
      end

      private

      def set_dashboard
        @dashboard = @local_customer.dashboards.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error("Dashboard not found", status: :not_found)
      end

      def dashboard_params
        params.permit(:name, :description, :is_default, layout_config: {})
      end
    end
  end
end
