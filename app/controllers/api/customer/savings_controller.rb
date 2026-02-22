# frozen_string_literal: true

module Api
  module Customer
    class SavingsController < BaseController
      # POST /customers/:customer_uuid/api/savings/commitments
      def commitments
        forward_post(:commitments)
      end

      # POST /customers/:customer_uuid/api/savings/metrics
      def metrics
        forward_post(:savings_metrics)
      end

      # GET /customers/:customer_uuid/api/savings/plan/:plan_uuid
      def plan
        Rails.logger.info("[Savings] Plan lookup: customer=#{customer_uuid} plan=#{params[:plan_uuid]}")
        Rails.logger.info("[Savings] PLATFORM_API_URL=#{ENV['PLATFORM_API_URL']}")

        response = platform_client.commitment_plan_details(
          customer_uuid: customer_uuid,
          plan_uuid: params[:plan_uuid]
        )

        Rails.logger.info("[Savings] Platform API response: status=#{response.status}")

        if response.success?
          render json: response.body, status: response.status
        else
          Rails.logger.warn("[Savings] Platform API error: #{response.error || response.body}")
          render json: { error: response.error || response.body },
                 status: error_status(response)
        end
      end
      # POST /customers/:customer_uuid/api/savings/apply_plan
      def apply_plan
        response = platform_client.apply_commitment_plan(
          customer_uuid: customer_uuid,
          plan_uuid: params.require(:plan_uuid)
        )

        if response.success?
          render json: response.body, status: response.status
        else
          render json: { error: response.error || response.body },
                 status: error_status(response)
        end
      end

      private

      def forward_post(method)
        body = savings_body_params.merge(customer_uuid: customer_uuid)
        response = cost_client.public_send(method, body)

        if response.success?
          render json: response.body, status: response.status
        else
          render json: { error: response.error || response.body },
                 status: error_status(response)
        end
      end

      def customer_uuid
        params[:customer_uuid]
      end

      def cost_client
        @cost_client ||= CostApiClient.new
      end

      def platform_client
        @platform_client ||= PlatformApiClient.new
      end

      def savings_body_params
        params.except(:controller, :action, :customer_uuid, :format, :saving).permit!.to_h
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
