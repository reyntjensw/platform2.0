# frozen_string_literal: true

module Api
  module Callbacks
    class DeploymentsController < ActionController::API
      before_action :verify_service_token

      # PATCH /api/callbacks/deployments/:id
      def update
        deployment = Deployment.find(params[:id])

        attrs = {}
        attrs[:status] = params[:status] if params[:status].present?
        attrs[:plan_output] = params[:plan_output] if params[:plan_output].present?
        attrs[:result] = params[:result] if params[:result].present?
        attrs[:completed_at] = Time.current if %w[planned completed failed].include?(params[:status])

        deployment.update!(attrs)

        # Broadcast Turbo Stream to environment channel
        Turbo::StreamsChannel.broadcast_replace_to(
          "environment_#{deployment.local_environment_id}",
          target: "deploy-status",
          partial: "environments/deploy_status",
          locals: { deployment: deployment }
        )

        head :ok
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Deployment not found" }, status: :not_found
      end

      private

      def verify_service_token
        token = request.headers["X-Service-Token"]
        expected = ENV.fetch("PIPELINE_SERVICE_TOKEN", "dev-token")

        unless ActiveSupport::SecurityUtils.secure_compare(token.to_s, expected)
          render json: { error: "Unauthorized" }, status: :unauthorized
        end
      end
    end
  end
end
