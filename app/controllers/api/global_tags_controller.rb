# frozen_string_literal: true

module Api
  class GlobalTagsController < ApplicationController
    include Authentication
    before_action :require_authentication
    before_action :set_tag, only: [:update, :destroy, :toggle]
    before_action :set_scope, only: [:index, :create]

    # GET /api/global_tags
    # GET /api/global_tags?scope_type=LocalCustomer&scope_id=xxx
    def index
      tags = scoped_tags.by_key
      render json: tags, methods: [:level_label]
    end

    # GET /api/global_tags/merged?environment_id=xxx
    def merged
      env = LocalEnvironment.find(params[:environment_id])
      render json: GlobalTag.merged_tags_for(env)
    end

    # GET /api/global_tags/by_level?environment_id=xxx
    def by_level
      env = LocalEnvironment.find(params[:environment_id])
      levels = GlobalTag.tags_by_level_for(env)
      render json: levels.map { |l|
        {
          level: l[:level],
          taggable_type: l[:taggable]&.class&.name,
          taggable_id: l[:taggable]&.id,
          tags: l[:tags].map { |t|
            { id: t.id, key: t.key, value: t.value, description: t.description,
              enabled: t.enabled, level_label: t.level_label }
          }
        }
      }
    end

    # POST /api/global_tags
    def create
      tag = GlobalTag.new(tag_params)
      assign_scope(tag)
      if tag.save
        render json: tag, methods: [:level_label], status: :created
      else
        render json: { errors: tag.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # PATCH /api/global_tags/:id
    def update
      if @tag.update(tag_params)
        render json: @tag, methods: [:level_label]
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
      render json: @tag, methods: [:level_label]
    end

    private

    def set_tag
      @tag = GlobalTag.find(params[:id])
    end

    def set_scope
      @scope_type = params[:scope_type]
      @scope_id = params[:scope_id]
      @scope_record = resolve_scope(@scope_type, @scope_id)
    end

    def scoped_tags
      if @scope_record
        GlobalTag.for_taggable(@scope_record)
      else
        GlobalTag.platform
      end
    end

    def assign_scope(tag)
      if @scope_record
        tag.taggable = @scope_record
      else
        tag.taggable_type = nil
        tag.taggable_id = nil
      end
    end

    def resolve_scope(type, id)
      return nil if type.blank? || id.blank?
      return nil unless GlobalTag::TAGGABLE_TYPES.include?(type)
      type.constantize.find_by(id: id)
    end

    def tag_params
      params.permit(:key, :value, :description, :enabled)
    end
  end
end
