# frozen_string_literal: true

class ModuleUpdatesController < AuthenticatedController
  # GET /modules/:module_id/updates
  def index
    @module_definition = ModuleDefinition.find(params[:module_id])
    @renderers = @module_definition.module_renderers.includes(:module_versions)
    @versions = @renderers.flat_map(&:module_versions).sort_by(&:scanned_at).reverse
    @affected_resources = Resource.where(module_definition: @module_definition).includes(:local_environment)
  end

  # POST /modules/:module_id/check_updates
  def check_updates
    @module_definition = ModuleDefinition.find(params[:module_id])
    renderer = @module_definition.module_renderers.first
    return redirect_with_alert("No renderer found") unless renderer

    # Scan the latest tag
    scanner = ModuleScanService.new
    result = scanner.scan(
      source_url: renderer.source_url,
      source_ref: params[:new_ref] || "main",
      source_subpath: renderer.source_subpath,
      git_token: renderer.git_credential&.token
    )

    unless result[:success] && result.dig(:data, "status") == "success"
      return redirect_with_alert(result.dig(:data, "error_message") || "Scan failed")
    end

    new_vars = result[:data]["variables"] || []
    new_outputs = result[:data]["outputs"] || []
    old_vars = renderer.discovered_vars.is_a?(Array) ? renderer.discovered_vars : []

    # Generate compatibility report
    report = VersionComparisonService.compare(old_vars, new_vars)

    # Create ModuleVersion
    version = renderer.module_versions.find_or_initialize_by(version_ref: params[:new_ref] || "main")
    version.assign_attributes(
      discovered_vars: new_vars,
      discovered_outputs: new_outputs,
      breaking: report["breaking"],
      compatibility_report: report,
      scanned_at: Time.current
    )
    version.save!

    # Flag affected resources
    if report["breaking"] || report["added"].any? || report["removed"].any?
      Resource.where(module_definition: @module_definition).update_all(
        upgrade_available: true,
        upgrade_report: report
      )
    end

    flash[:notice] = report["breaking"] ? "Breaking changes detected in #{params[:new_ref]}" : "New version #{params[:new_ref]} available"
    redirect_to module_updates_path(@module_definition)
  end

  # POST /modules/:module_id/updates/:id/upgrade_resource
  def upgrade_resource
    resource = Resource.find(params[:resource_id])
    version = ModuleVersion.find(params[:id])

    # Check environment upgrade policy
    env = resource.local_environment
    if env.upgrade_policy == "locked"
      return render json: { error: "Environment #{env.name} is locked — upgrades not allowed" }, status: :forbidden
    end

    if version.breaking? && env.upgrade_policy != "auto"
      # Breaking upgrades always require manual review
    end

    # Update resource version pin
    resource.update!(
      renderer_ref: version.version_ref,
      upgrade_available: false,
      upgrade_report: {}
    )

    flash[:notice] = "Resource #{resource.name} upgraded to #{version.version_ref}"
    redirect_to module_updates_path(params[:module_id])
  end

  # POST /modules/:module_id/updates/upgrade_all
  def upgrade_all
    @module_definition = ModuleDefinition.find(params[:module_id])
    renderer = @module_definition.module_renderers.first
    latest_version = renderer&.module_versions&.recent&.first

    return redirect_with_alert("No version available") unless latest_version
    return redirect_with_alert("Cannot batch-upgrade breaking changes") if latest_version.breaking?

    upgraded = 0
    Resource.where(module_definition: @module_definition, upgrade_available: true).find_each do |resource|
      next if resource.local_environment.upgrade_policy == "locked"

      resource.update!(
        renderer_ref: latest_version.version_ref,
        upgrade_available: false,
        upgrade_report: {}
      )
      upgraded += 1
    end

    flash[:notice] = "Upgraded #{upgraded} resource(s) to #{latest_version.version_ref}"
    redirect_to module_updates_path(@module_definition)
  end

  private

  def redirect_with_alert(message)
    flash[:alert] = message
    redirect_to module_path(params[:module_id])
  end
end
