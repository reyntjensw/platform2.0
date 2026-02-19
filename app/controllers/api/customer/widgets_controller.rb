# frozen_string_literal: true

module Api
  module Customer
    class WidgetsController < BaseController
      before_action :set_dashboard
      before_action :set_widget, only: [:update, :destroy]

      # POST /customers/:customer_uuid/api/dashboards/:dashboard_id/widgets
      def create
        widget = @dashboard.widgets.new(widget_params)
        widget.position = @dashboard.widgets.maximum(:position).to_i + 1

        if widget.save
          render_json(widget.as_json(include: :widget_filters), status: :created)
        else
          render_error(widget.errors.full_messages, status: :unprocessable_entity)
        end
      end

      # PATCH /customers/:customer_uuid/api/dashboards/:dashboard_id/widgets/:id
      def update
        if @widget.update(widget_params)
          render_json(@widget.as_json(include: :widget_filters))
        else
          render_error(@widget.errors.full_messages, status: :unprocessable_entity)
        end
      end

      # DELETE /customers/:customer_uuid/api/dashboards/:dashboard_id/widgets/:id
      def destroy
        @widget.destroy!
        head :no_content
      end

      private

      def set_dashboard
        @dashboard = @local_customer.dashboards.find(params[:dashboard_id])
      rescue ActiveRecord::RecordNotFound
        render_error("Dashboard not found", status: :not_found)
      end

      def set_widget
        @widget = @dashboard.widgets.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error("Widget not found", status: :not_found)
      end

      def widget_params
        params.permit(:chart_type, :title, :is_saved, :is_expanded, query_config: {}, display_config: {})
      end
    end
  end
end
