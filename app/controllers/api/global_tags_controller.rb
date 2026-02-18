# frozen_string_literal: true

module Api
  class GlobalTagsController < ApplicationController
    include Authentication
    before_action :require_authentication
    before_action :set_tag, only: [:update, :destroy, :toggle]

    # GET /api/global_tags
    def index
      render json: GlobalTag.by_key
    end

    # POST /api/global_tags
    def create
      tag = GlobalTag.new(tag_params)
      if tag.save
        render json: tag, status: :created
      else
        render json: { errors: tag.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # PATCH /api/global_tags/:id
    def update
      if @tag.update(tag_params)
        render json: @tag
      else
        render json: { errors: @tag.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # DELETE /api/global_tags/:id
    def destroy
      @tag.destroy!
      head :no_content
    end

    # PATCH /api/global_tags/:id/toggle
    def toggle
      @tag.update!(enabled: !@tag.enabled)
      render json: @tag
    end

    private

    def set_tag
      @tag = GlobalTag.find(params[:id])
    end

    def tag_params
      params.permit(:key, :value, :description, :enabled)
    end
  end
end
