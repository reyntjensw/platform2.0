# frozen_string_literal: true

module Api
  module Customer
    class CostController < BaseController
      # POST /customers/:customer_uuid/api/cost/daily_spend
      def daily_spend
        forward_post(:daily_spend)
      end

      # POST /customers/:customer_uuid/api/cost/service_spend
      def service_spend
        forward_post(:service_spend)
      end

      # POST /customers/:customer_uuid/api/cost/storage_spend
      def storage_spend
        forward_post(:storage_spend)
      end

      # POST /customers/:customer_uuid/api/cost/monthly_spend_trend
      def monthly_spend_trend
        forward_post(:monthly_spend_trend)
      end

      # POST /customers/:customer_uuid/api/cost/account_spend_distribution
      def account_spend_distribution
        forward_post(:account_spend_distribution)
      end

      # POST /customers/:customer_uuid/api/cost/top_services
      def top_services
        forward_post(:top_services)
      end

      # GET /customers/:customer_uuid/api/cost/accounts
      def accounts
        response = cost_client.accounts(customer_uuid, provider: params[:provider])
        render_cost_response(response)
      end

      # GET /customers/:customer_uuid/api/cost/services
      def services
        response = cost_client.services(customer_uuid, provider: params[:provider])
        render_cost_response(response)
      end

      private

      def forward_post(method)
        body = cost_body_params.merge(customer_uuid: customer_uuid)
        response = cost_client.public_send(method, body)
        render_cost_response(response)
      end

      def render_cost_response(response)
        if response.success?
          render json: response.body, status: response.status
        else
          render json: { error: response.error || response.body },
                 status: error_status(response)
        end
      end

      def error_status(response)
        case response.status
        when 0 then :bad_gateway
        when 400..499 then response.status
        when 500..599 then response.status
        else :internal_server_error
        end
      end

      def customer_uuid
        params[:customer_uuid]
      end

      def cost_client
        @cost_client ||= CostApiClient.new
      end

      def cost_body_params
        params.except(:controller, :action, :customer_uuid, :format).permit!.to_h
      end
    end
  end
end
