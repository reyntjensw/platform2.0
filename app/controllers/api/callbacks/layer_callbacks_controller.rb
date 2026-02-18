# frozen_string_literal: true

module Api
  module Callbacks
    class LayerCallbacksController < ActionController::API
      before_action :verify_service_token

      # PATCH /api/callbacks/deployments/:deployment_id/layers/:id
      #
      # Called by the runner when a layer job completes or fails.
      # Expects params: status, action ("plan" or "deploy"),
      # and optionally: plan_output, cost_estimate, error_details.
      def update
        deployment = Deployment.find(params[:deployment_id])
        layer = deployment.deployment_layers.find(params[:id])

        update_layer(layer)

        case layer.status
        when "completed"
          deploy_service(deployment).on_layer_completed(deployment, layer, action: params[:action])
        when "failed"
          deploy_service(deployment).on_layer_failed(deployment, layer)
        end

        broadcast_status(deployment.reload)

        head :ok
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Deployment or layer not found" }, status: :not_found
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def update_layer(layer)
        status = params.require(:status)

        unless DeploymentLayer::STATUSES.include?(status)
          raise ArgumentError, "Invalid layer status: #{status}"
        end

        attrs = { status: status }
        attrs[:plan_output] = params[:plan_output] if params[:plan_output].present?
        attrs[:cost_estimate] = params[:cost_estimate] if params[:cost_estimate].present?
        attrs[:error_details] = params[:error_details] if params[:error_details].present?
        attrs[:completed_at] = Time.current if %w[completed failed].include?(status)

        layer.update!(attrs)
      end

      def deploy_service(deployment)
        # DeployService needs an environment and user; for callbacks we use
        # the environment from the deployment and a system-level context.
        DeployService.new(deployment.local_environment, nil)
      end

      def broadcast_status(deployment)
        Turbo::StreamsChannel.broadcast_replace_to(
          "environment_#{deployment.local_environment_id}",
          target: "deploy-status",
          partial: "environments/deploy_status",
          locals: { deployment: deployment }
        )
      rescue => e
        # Don't fail the callback if broadcasting fails
        Rails.logger.warn("Failed to broadcast deployment status: #{e.message}")
      end

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
