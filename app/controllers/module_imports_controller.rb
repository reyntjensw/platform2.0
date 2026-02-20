# frozen_string_literal: true

class ModuleImportsController < AuthenticatedController
  before_action :require_manage_modules
  before_action :set_draft, except: [:new]

  # GET /modules/import/new — Start a new import wizard
  def new
    @draft = ModuleImportDraft.create!(
      user_uuid: current_user.uuid,
      owner: determine_owner,
      current_step: 1
    )
    redirect_to step_module_import_path(@draft, step: "source")
  end

  # GET /modules/import/:id/step/:step — Show a wizard step
  def step
    @step = params[:step]
    case @step
    when "source"
      render_step(1)
    when "auth"
      @credentials = available_credentials
      render_step(2)
    when "scan"
      render_step(3)
    when "classify"
      render_step(4)
    when "configure"
      @user_config_vars = @draft.variables.select { |v| @draft.classifications[v["name"]] == "user_config" }
      @dependency_vars = @draft.variables.select { |v| @draft.classifications[v["name"]] == "dependency" }
      @available_modules = ModuleDefinition.live.order(:display_name)
      render_step(5)
    when "metadata"
      render_step(6)
    else
      redirect_to step_module_import_path(@draft, step: "source")
    end
  end

  # PATCH /modules/import/:id/save_source
  def save_source
    service = ModuleImportService.new(@draft)
    service.save_source(source_params)

    if @draft.import_method == "registry"
      redirect_to step_module_import_path(@draft, step: "scan")
    elsif @draft.ssh_with_platform_key?
      # CloudSisters SSH repos use the bundled deploy key — skip auth
      redirect_to step_module_import_path(@draft, step: "scan")
    elsif @draft.needs_auth?
      redirect_to step_module_import_path(@draft, step: "auth")
    else
      redirect_to step_module_import_path(@draft, step: "scan")
    end
  end

  # PATCH /modules/import/:id/save_auth
  def save_auth
    service = ModuleImportService.new(@draft)
    if params[:git_credential_id].present?
      service.save_auth(params[:git_credential_id])
    else
      service.skip_auth
    end
    redirect_to step_module_import_path(@draft, step: "scan")
  end

  # POST /modules/import/:id/run_scan
  def run_scan
    service = ModuleImportService.new(@draft)
    result = service.run_scan

    if result[:success]
      redirect_to step_module_import_path(@draft, step: "classify")
    else
      flash[:alert] = result[:error]
      redirect_to step_module_import_path(@draft, step: "scan")
    end
  end

  # PATCH /modules/import/:id/save_classifications
  def save_classifications
    service = ModuleImportService.new(@draft)
    service.save_classifications(params[:classifications]&.to_unsafe_h || {})
    redirect_to step_module_import_path(@draft, step: "configure")
  end

  # PATCH /modules/import/:id/save_field_configs
  def save_field_configs
    service = ModuleImportService.new(@draft)
    service.save_field_configs(params[:field_configs]&.to_unsafe_h || {})
    redirect_to step_module_import_path(@draft, step: "metadata")
  end

  # POST /modules/import/:id/finalize
  def finalize
    service = ModuleImportService.new(@draft)
    publish = params[:publish] == "true"
    mod = service.finalize(metadata_params.to_h, publish: publish)

    flash[:notice] = publish ? "Module published successfully" : "Module saved as draft"
    redirect_to module_path(mod), only_path: true
  end

  # POST /modules/import/:id/verify_credential
  def verify_credential
    credential = GitCredential.find(params[:credential_id])
    result = GitCredentialVerificationService.verify(credential)
    render json: result
  end

  # POST /modules/import/:id/create_credential
  def create_credential
    credential = GitCredential.new(credential_params)
    credential.owner = determine_owner

    if credential.save
      result = GitCredentialVerificationService.verify(credential)
      render json: { id: credential.id, name: credential.name, verified: result[:verified], message: result[:message] }
    else
      render json: { error: credential.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  # GET /modules/import/:id/registry_versions
  def registry_versions
    client = PipelineClient.new
    result = client.registry_versions(
      namespace: params[:namespace],
      name: params[:name],
      provider: params[:provider]
    )
    render json: result[:data] || { error: result[:error] }
  end

  private

  def set_draft
    @draft = ModuleImportDraft.find(params[:id])
  end

  def render_step(step_number)
    @draft.update(current_step: step_number) if @draft.current_step < step_number
    render "module_imports/steps/#{params[:step]}"
  end

  def source_params
    params.permit(:import_method, :source_url, :source_ref, :source_subpath, :engine, :cloud_provider,
                  :registry_namespace, :registry_name, :registry_provider)
  end

  def metadata_params
    params.permit(:display_name, :internal_name, :description, :category, :icon, :icon_color)
  end

  def credential_params
    params.permit(:name, :host, :credential_type, :token, :scope)
  end

  def available_credentials
    if @draft.source_url&.match?(/\Agit@/)
      # SSH URLs don't use token-based credentials
      host = @draft.source_url&.match(/\Agit@([^:]+)/)&.captures&.first
      scope = GitCredential.active.where(credential_type: "ssh_key")
      scope = scope.where(host: host) if host.present?
    else
      host = URI.parse(@draft.source_url || "").host rescue nil
      scope = GitCredential.active
      scope = scope.where(host: host) if host.present?
    end
    scope.order(:name)
  end

  def determine_owner
    if current_user.platform_admin?
      nil # Platform module — no owner
    elsif current_user.reseller_admin?
      LocalReseller.find_by(id: current_user.reseller_uuid)
    elsif current_user.customer_admin?
      LocalCustomer.find_by(id: current_user.customer_uuid)
    end
  end

  def require_manage_modules
    return if current_user&.platform_admin?
    return if current_user&.reseller_admin?
    return if current_user&.customer_admin?
    raise Authorization::NotAuthorizedError, "You do not have permission to import modules"
  end
end
