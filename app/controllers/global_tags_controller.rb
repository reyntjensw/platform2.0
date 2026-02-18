# frozen_string_literal: true

class GlobalTagsController < AuthenticatedController
  before_action :set_tag, only: [:update, :destroy, :toggle]

  # GET /settings/global_tags
  def index
    @tags = GlobalTag.by_key
  end

  # POST /settings/global_tags
  def create
    @tag = GlobalTag.new(tag_params)
    if @tag.save
      flash[:notice] = "Tag '#{@tag.key}' created"
    else
      flash[:alert] = @tag.errors.full_messages.join(", ")
    end
    redirect_to global_tags_path
  end

  # PATCH /settings/global_tags/:id
  def update
    if @tag.update(tag_params)
      flash[:notice] = "Tag '#{@tag.key}' updated"
    else
      flash[:alert] = @tag.errors.full_messages.join(", ")
    end
    redirect_to global_tags_path
  end

  # DELETE /settings/global_tags/:id
  def destroy
    @tag.destroy!
    flash[:notice] = "Tag '#{@tag.key}' deleted"
    redirect_to global_tags_path
  end

  # PATCH /settings/global_tags/:id/toggle
  def toggle
    @tag.update!(enabled: !@tag.enabled)
    flash[:notice] = "Tag '#{@tag.key}' #{@tag.enabled? ? 'enabled' : 'disabled'}"
    redirect_to global_tags_path
  end

  private

  def set_tag
    @tag = GlobalTag.find(params[:id])
  end

  def tag_params
    params.permit(:key, :value, :description, :enabled)
  end
end
