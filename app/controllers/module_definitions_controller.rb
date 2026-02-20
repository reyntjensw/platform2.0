# frozen_string_literal: true

class ModuleDefinitionsController < AuthenticatedController
  before_action :require_manage_access, except: [:index, :show]
  before_action :set_module, only: [:show, :edit, :update, :deprecate, :destroy, :rescan]

  # GET /modules
  def index
    @modules = scoped_modules.includes(:module_fields, :module_outputs, :module_renderers)
    @modules = @modules.by_cloud_provider(params[:cloud_provider]) if params[:cloud_provider].present?
    @modules = @modules.by_category(params[:category]) if params[:category].present?
    @modules = @modules.where(status: params[:status]) if params[:status].present?
    @modules = @modules.where(ownership: params[:ownership]) if params[:ownership].present?
    @modules = @modules.live unless params[:status].present?

    @categories = scoped_modules.live.group(:category).count
    @cloud_providers = scoped_modules.live.distinct.pluck(:cloud_provider).sort
    @user_role = current_user&.roles&.first || "customer_viewer"
    @can_edit_ids = @modules.select { |m| can_edit_module?(m) }.map(&:id).to_set
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
    @can_edit = can_edit_module?(@module_definition)
  end

  # GET /modules/:id/edit
  def edit
    @module_definition = ModuleDefinition.includes(
      :module_fields, :module_outputs,
      module_renderers: :field_mappings
    ).find(params[:id])
    @user_role = current_user&.roles&.first || "customer_viewer"

    unless can_edit_module?(@module_definition)
      flash[:alert] = "You don't have permission to edit this module"
      redirect_to module_path(@module_definition)
    end
  end

  # PATCH /modules/:id
  def update
    unless can_edit_module?(@module_definition)
      flash[:alert] = "You don't have permission to edit this module"
      redirect_to module_path(@module_definition) and return
    end

    # Enforce ownership restrictions
    new_ownership = module_definition_params[:ownership]
    if new_ownership.present?
      if new_ownership == "platform" && !current_user&.platform_admin?
        flash[:alert] = "Only platform admins can set platform ownership"
        render :edit, status: :unprocessable_entity and return
      end
      if new_ownership == "reseller" && !(current_user&.platform_admin? || current_user&.reseller_admin?)
        flash[:alert] = "Only platform or reseller admins can set reseller ownership"
        render :edit, status: :unprocessable_entity and return
      end
    end

    if @module_definition.update(module_definition_params)
      flash[:notice] = "#{@module_definition.display_name} updated successfully"
      redirect_to module_path(@module_definition)
    else
      render :edit, status: :unprocessable_entity
    end
  end


  # POST /modules/:id/deprecate
  def deprecate
    unless can_edit_module?(@module_definition)
      flash[:alert] = "You don't have permission to modify this module"
      redirect_to module_path(@module_definition) and return
    end
    @module_definition.update!(status: "deprecated")
    flash[:notice] = "#{@module_definition.display_name} has been deprecated"
    redirect_to module_path(@module_definition)
  end

  # DELETE /modules/:id
  def destroy
    unless can_edit_module?(@module_definition)
      flash[:alert] = "You don't have permission to delete this module"
      redirect_to module_path(@module_definition) and return
    end
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
    unless can_edit_module?(@module_definition)
      flash[:alert] = "You don't have permission to modify this module"
      redirect_to module_path(@module_definition) and return
    end
    renderer = @module_definition.module_renderers.first
    unless renderer
      flash[:alert] = "No renderer to scan"
      redirect_to module_path(@module_definition)
      return
    end

    scanner = ModuleScanService.new
    is_ssh = renderer.source_url&.match?(/\Agit@gitlab\.com:cloudsisters/)
    result = scanner.scan(
      source_url: renderer.source_url,
      source_ref: renderer.source_ref,
      source_subpath: renderer.source_subpath,
      git_token: is_ssh ? nil : renderer.git_credential&.token,
      use_ssh: is_ssh
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

  # Returns modules visible to the current user based on their role.
  # Uses the ownership field and current_user's UUIDs to scope access.
  # Platform modules are always visible to everyone.
  def scoped_modules
    if current_user&.platform_admin?
      ModuleDefinition.all
    elsif current_user&.reseller_admin?
      # See platform + own reseller modules + customer modules under this reseller
      ModuleDefinition.where(ownership: "platform")
        .or(ModuleDefinition.where(ownership: "reseller"))
        .or(ModuleDefinition.where(ownership: "customer"))
    else
      # Customers see platform + their reseller's modules + their own
      ModuleDefinition.where(ownership: "platform")
        .or(ModuleDefinition.where(ownership: "reseller"))
        .or(ModuleDefinition.where(ownership: "customer"))
    end
  end

  def require_manage_access
    return if current_user&.platform_admin?
    return if current_user&.reseller_admin?
    return if current_user&.customer_admin?
    raise Authorization::NotAuthorizedError, "You do not have permission to manage modules"
  end

  # Determines if the current user can edit/delete a specific module.
  # Platform modules: only platform admins.
  # Reseller modules: platform admins + reseller admins.
  # Customer modules: platform admins + reseller admins + customer admins.
  def can_edit_module?(mod)
    return true if current_user&.platform_admin?
    return false if mod.ownership == "platform"
    return true if current_user&.reseller_admin? && mod.ownership.in?(%w[reseller customer])
    return true if current_user&.customer_admin? && mod.ownership == "customer"
    false
  end

  def module_definition_params
    permitted = params.require(:module_definition).permit(
      :display_name, :category, :status, :ownership,
      :visibility, :description, :version, :icon,
      :constraints, :supported_engines,
      allowed_zones: [],
      provider_dependencies: [],
      module_fields_attributes: [
        :id, :name, :label, :field_type, :classification,
        :required, :default_value, :group, :position, :validation, :data_source,
        :dependency_config_source_module, :dependency_config_source_output, :_destroy
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
    permitted[:provider_dependencies] = permitted[:provider_dependencies]&.reject(&:blank?)
    permitted[:constraints] = JSON.parse(permitted[:constraints]) if permitted[:constraints].is_a?(String)
    permitted[:supported_engines] = JSON.parse(permitted[:supported_engines]) if permitted[:supported_engines].is_a?(String)

    # Merge dependency_config fields into the dependency_config JSON column
    if permitted[:module_fields_attributes]
      permitted[:module_fields_attributes].each do |_key, attrs|
        next unless attrs.is_a?(ActionController::Parameters) || attrs.is_a?(Hash)
        src_module = attrs.delete(:dependency_config_source_module)
        src_output = attrs.delete(:dependency_config_source_output)
        if src_module.present? || src_output.present?
          attrs[:dependency_config] = {
            "source_module" => src_module.presence,
            "source_output" => src_output.presence
          }.compact
        end
      end
    end

    permitted
  rescue JSON::ParserError
    permitted
  end

end
