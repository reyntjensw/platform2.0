# frozen_string_literal: true

module Api
  module Customer
    class BaseController < ApplicationController
      include Authentication
      include Authorization

      before_action :require_authentication
      skip_forgery_protection

      before_action :set_local_customer

      private

      def set_local_customer
        @local_customer = LocalCustomer.find_by!(slug: params[:customer_uuid])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Customer not found" }, status: :not_found
      end

      def render_json(data, status: :ok)
        render json: data, status: status
      end

      def render_error(message, status: :unprocessable_entity)
        render json: { error: message }, status: status
      end
    end
  end
end
