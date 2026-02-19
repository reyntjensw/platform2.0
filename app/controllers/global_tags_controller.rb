# frozen_string_literal: true

class GlobalTagsController < AuthenticatedController
  before_action :set_tag, only: [:update, :destroy, :toggle]
  before_action :set_scope, only: [:index, :create, :update, :destroy, :toggle]

  # GET /settings/global_tags
  # GET /settings/global_tags?scope_type=LocalCustomer&scope_id=xxx
  def index
    @tags = scoped_tags.by_key
    @all_levels = build_level_options
  end

  # POST /settings/global_tags
  def create
    @tag = GlobalTag.new(tag_params)
    assign_scope(@tag)
    if @tag.save
      flash[:notice] = "Tag '#{@tag.key}' created at #{@tag.level_label} level"
    else
      flash[:alert] = @tag.errors.full_messages.join(", ")
    end
    redirect_to global_tags_path(scope_params)
  end

  # PATCH /settings/global_tags/:id
  def update
    if @tag.update(tag_params)
      flash[:notice] = "Tag '#{@tag.key}' updated"
    else
      flash[:alert] = @tag.errors.full_messages.join(", ")
    end
    redirect_to global_tags_path(scope_params)
  end

  # DELETE /settings/global_tags/:id
  def destroy
    @tag.destroy!
    flash[:notice] = "Tag '#{@tag.key}' deleted"
    redirect_to global_tags_path(scope_params)
  end

  # PATCH /settings/global_tags/:id/toggle
  def toggle
    @tag.update!(enabled: !@tag.enabled)
    flash[:notice] = "Tag '#{@tag.key}' #{@tag.enabled? ? 'enabled' : 'disabled'}"
    redirect_to global_tags_path(scope_params)
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

  def scope_params
    { scope_type: @scope_type, scope_id: @scope_id }.compact_blank
  end

  def tag_params
    params.permit(:key, :value, :description, :enabled)
  end

  def build_level_options
    levels = [{ label: "Platform (all deployments)", type: nil, id: nil, current: @scope_record.nil? }]

    LocalReseller.order(:name).each do |r|
      levels << { label: "Reseller: #{r.name}", type: "LocalReseller", id: r.id, current: @scope_record == r }
    end

    LocalCustomer.includes(:local_reseller).order(:name).each do |c|
      levels << { label: "Customer: #{c.name} (#{c.local_reseller&.name})", type: "LocalCustomer", id: c.id, current: @scope_record == c }
    end

    LocalProject.includes(local_customer: :local_reseller).order(:name).each do |p|
      levels << { label: "Project: #{p.name} (#{p.local_customer&.name})", type: "LocalProject", id: p.id, current: @scope_record == p }
    end

    levels
  end
end
