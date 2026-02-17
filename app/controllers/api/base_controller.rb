# frozen_string_literal: true

module Api
  class BaseController < AuthenticatedController
    skip_forgery_protection

    before_action :set_environment

    private

    def set_environment
      @environment = LocalEnvironment.find(params[:environment_id] || params[:environment_uuid])
    rescue ActiveRecord::RecordNotFound
      render json: { error: "Environment not found" }, status: :not_found
    end

    def render_json(data, status: :ok)
      render json: data, status: status
    end

    def render_error(message, status: :unprocessable_entity)
      render json: { error: message }, status: status
    end
  end
end
