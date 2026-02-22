# frozen_string_literal: true

module Api
  module Customer
    class InventoryController < BaseController
      # POST /customers/:customer_uuid/api/inventory/resources
      def resources
        body = inventory_params.merge(customer_uuid: customer_uuid)
        response = cost_client.inventory_resources(customer_uuid, body)

        if response.success?
          render json: response.body, status: response.status
        else
          render json: { error: response.error || response.body },
                 status: error_status(response)
        end
      end

      private

      def customer_uuid
        params[:customer_uuid]
      end

      def cost_client
        @cost_client ||= CostApiClient.new
      end

      def inventory_params
        params.except(:controller, :action, :customer_uuid, :format).permit!.to_h
      end

      def error_status(response)
        case response.status
        when 0 then :bad_gateway
        when 400..499 then response.status
        when 500..599 then response.status
        else :internal_server_error
        end
      end
    end
  end
end
