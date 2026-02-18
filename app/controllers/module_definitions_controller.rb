# frozen_string_literal: true

class ModuleDefinitionsController < AuthenticatedController
  before_action :set_module, only: [:show, :edit, :update, :deprecate, :destroy, :rescan]

  # GET /modules
  def index
    @modules = ModuleDefinition.includes(:module_fields, :module_outputs, :module_renderers)
    @modules = @modules.by_cloud_provider(params[:cloud_provider]) if params[:cloud_provider].present?
    @modules = @modules.by_category(params[:category]) if params[:category].present?
    @modules = @modules.where(status: params[:status]) if params[:status].present?
    @modules = @modules.where(ownership: params[:ownership]) if params[:ownership].present?
    @modules = @modules.live unless params[:status].present?

    @categories = ModuleDefinition.live.group(:category).count
    @cloud_providers = ModuleDefinition.live.distinct.pluck(:cloud_provider).sort
  end

  # GET /modules/:id
  def show
    @module_definition = ModuleDefinition.includes(
      :module_fields, :module_outputs,
      module_renderers: [:field_mappings, :module_versions]
    ).find(params[:id])

    @usage_count = Resource.where(module_definition: @module_definition).count
    @affected_environments = Resource.where(module_definition: @module_definition)
                                     .includes(local_environment: :local_project)
                                     .map(&:local_environment).uniq
  end

  # GET /modules/:id/edit
  def edit
    @module_definition = ModuleDefinition.includes(
      :module_fields, :module_outputs,
      module_renderers: :field_mappings
    ).find(params[:id])
  end

  # PATCH /modules/:id
  def update
    if @module_definition.update(module_definition_params)
      flash[:notice] = "#{@module_definition.display_name} updated successfully"
      redirect_to module_path(@module_definition)
    else
      render :edit, status: :unprocessable_entity
    end
  end


  # POST /modules/:id/deprecate
  def deprecate
    @module_definition.update!(status: "deprecated")
    flash[:notice] = "#{@module_definition.display_name} has been deprecated"
    redirect_to module_path(@module_definition)
  end

  # DELETE /modules/:id
  def destroy
    usage_count = Resource.where(module_definition: @module_definition).count
    if usage_count > 0
      flash[:alert] = "Cannot delete — #{usage_count} resource(s) are using this module"
      redirect_to module_path(@module_definition)
      return
    end

    @module_definition.destroy!
    flash[:notice] = "Module deleted"
    redirect_to modules_path
  end

  # POST /modules/:id/rescan
  def rescan
    renderer = @module_definition.module_renderers.first
    unless renderer
      flash[:alert] = "No renderer to scan"
      redirect_to module_path(@module_definition)
      return
    end

    scanner = ModuleScanService.new
    result = scanner.scan(
      source_url: renderer.source_url,
      source_ref: renderer.source_ref,
      source_subpath: renderer.source_subpath,
      git_token: renderer.git_credential&.token
    )

    if result[:success] && result[:data]["status"] == "success"
      renderer.update!(
        discovered_vars: result[:data]["variables"],
        discovered_outputs: result[:data]["outputs"],
        last_scanned_at: Time.current,
        scan_status: "ready"
      )
      flash[:notice] = "Re-scan complete"
    else
      flash[:alert] = result.dig(:data, "error_message") || "Scan failed"
    end

    redirect_to module_path(@module_definition)
  end

  private

  def set_module
    @module_definition = ModuleDefinition.find(params[:id])
  end

  def module_definition_params
    permitted = params.require(:module_definition).permit(
      :display_name, :category, :status, :ownership,
      :visibility, :description, :version, :icon,
      :constraints, :supported_engines,
      allowed_zones: [],
      module_fields_attributes: [
        :id, :name, :label, :field_type, :classification,
        :required, :default_value, :group, :position, :validation, :_destroy
      ],
      module_outputs_attributes: [
        :id, :name, :description, :output_type, :_destroy
      ],
      module_renderers_attributes: [
        :id, :engine, :source_type, :source_url, :source_ref, :source_subpath,
        :git_credential_id, :_destroy,
        field_mappings_attributes: [
          :id, :platform_field, :renderer_variable, :mapping_type, :transform, :_destroy
        ]
      ]
    )
    permitted[:allowed_zones] = permitted[:allowed_zones]&.reject(&:blank?)
    permitted[:constraints] = JSON.parse(permitted[:constraints]) if permitted[:constraints].is_a?(String)
    permitted[:supported_engines] = JSON.parse(permitted[:supported_engines]) if permitted[:supported_engines].is_a?(String)
    permitted
  rescue JSON::ParserError
    permitted
  end

end
