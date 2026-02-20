# frozen_string_literal: true

class ModuleImportService
  # Orchestrates the full module import wizard flow.
  # Each step validates and persists state to the ModuleImportDraft.

  def initialize(draft)
    @draft = draft
  end

  # Step 1: Save source configuration
  def save_source(params)
    @draft.update!(
      import_method: params[:import_method] || "git_url",
      source_url: params[:source_url]&.strip,
      source_ref: params[:source_ref]&.strip,
      source_subpath: params[:source_subpath]&.strip,
      engine: params[:engine] || "opentofu",
      cloud_provider: params[:cloud_provider],
      registry_namespace: params[:registry_namespace]&.strip,
      registry_name: params[:registry_name]&.strip,
      registry_provider: params[:registry_provider]&.strip,
      current_step: 2
    )
  end

  # Step 2: Save credential selection
  def save_auth(git_credential_id)
    @draft.update!(
      git_credential_id: git_credential_id,
      current_step: 3
    )
  end

  # Step 2 skip: for public repos or registry imports
  def skip_auth
    @draft.update!(current_step: 3)
  end

  # Step 3: Trigger scan and save results
  def run_scan
    token = @draft.ssh_url? ? nil : @draft.git_credential&.token
    scanner = ModuleScanService.new

    result = scanner.scan(
      source_url: @draft.source_url,
      source_ref: @draft.source_ref,
      source_subpath: @draft.source_subpath,
      engine: @draft.engine,
      git_token: token,
      use_ssh: @draft.ssh_with_platform_key?
    )

    if result[:success] && result[:data]["status"] == "success"
      # Pre-populate classifications from scanner suggestions
      classifications = {}
      (result[:data]["variables"] || []).each do |var|
        classifications[var["name"]] = var["suggested_classification"]
      end

      @draft.update!(
        scan_result: result[:data],
        classifications: classifications,
        current_step: 4
      )
      { success: true }
    else
      error_msg = result[:data]&.dig("error_message") || result[:error] || "Scan failed"
      { success: false, error: error_msg }
    end
  end

  # Step 4: Save classification overrides
  def save_classifications(classifications)
    @draft.update!(
      classifications: classifications,
      current_step: 5
    )
  end

  # Step 5: Save field configurations
  def save_field_configs(field_configs)
    @draft.update!(
      field_configs: field_configs,
      current_step: 6
    )
  end

  # Step 6: Save metadata and finalize
  def finalize(metadata, publish: false)
    @draft.update!(metadata: metadata)

    # Create the actual ModuleDefinition + related records
    mod = create_module_definition(publish)
    @draft.update!(status: "completed")
    mod
  end

  private

  def create_module_definition(publish)
    meta = @draft.metadata.symbolize_keys

    mod = ModuleDefinition.create!(
      owner: @draft.owner,
      name: meta[:internal_name].presence || meta[:display_name]&.parameterize(separator: "_"),
      display_name: meta[:display_name],
      description: meta[:description],
      version: @draft.source_ref || "1.0.0",
      status: publish ? "live" : "draft",
      cloud_provider: @draft.cloud_provider,
      category: meta[:category] || "other",
      icon: meta[:icon],
      ownership: determine_ownership,
      visibility: determine_visibility
    )

    create_fields(mod)
    create_outputs(mod)
    create_renderer(mod)

    mod
  end

  def create_fields(mod)
    @draft.variables.each_with_index do |var, idx|
      name = var["name"]
      classification = @draft.classifications[name] || var["suggested_classification"] || "user_config"
      next if classification == "hidden"

      field_config = (@draft.field_configs[name] || {}).symbolize_keys

      mod.module_fields.create!(
        name: name,
        label: field_config[:label] || name.titleize,
        field_type: field_config[:field_type] || var["suggested_field_type"] || "string",
        classification: classification,
        required: var["required"] || false,
        default_value: field_config[:default_value] || var["default"],
        defaults_by_env: field_config[:defaults_by_env],
        validation: build_validation(var, field_config),
        group: field_config[:group] || var["suggested_group"] || "General",
        position: idx,
        locked_in_envs: field_config[:locked_in_envs] || {},
        dependency_config: var["suggested_dependency"],
        platform_source: classification == "platform_managed" ? infer_platform_source(name) : nil,
        data_source: field_config[:data_source].presence
      )
    end
  end

  def create_outputs(mod)
    @draft.outputs.each do |out|
      mod.module_outputs.create!(
        name: out["name"],
        description: out["description"] || "",
        output_type: out["type"] || "string"
      )
    end
  end

  def create_renderer(mod)
    renderer = mod.module_renderers.create!(
      engine: @draft.engine,
      source_type: @draft.import_method == "upload" ? "inline" : "git",
      source_url: @draft.source_url,
      source_ref: @draft.source_ref,
      source_subpath: @draft.source_subpath,
      git_credential: @draft.git_credential,
      discovered_vars: @draft.scan_result["variables"] || [],
      discovered_outputs: @draft.scan_result["outputs"] || [],
      last_scanned_at: Time.current,
      scan_status: "ready"
    )

    # Create 1:1 field mappings (BYOM / customer modules)
    mod.module_fields.each do |field|
      renderer.field_mappings.create!(
        platform_field: field.name,
        renderer_variable: field.name,
        mapping_type: field.classification == "platform_managed" ? "platform_inject" : "direct"
      )
    end

    # Create initial ModuleVersion
    renderer.module_versions.create!(
      version_ref: @draft.source_ref || "1.0.0",
      discovered_vars: @draft.scan_result["variables"] || [],
      discovered_outputs: @draft.scan_result["outputs"] || [],
      scanned_at: Time.current,
      published_at: Time.current
    )
  end

  def build_validation(var, field_config)
    validation = {}
    if field_config[:min].present?
      validation["min"] = field_config[:min].to_i
    end
    if field_config[:max].present?
      validation["max"] = field_config[:max].to_i
    end
    if field_config[:allowed].present?
      validation["allowed"] = field_config[:allowed]
    end
    if field_config[:regex].present?
      validation["regex"] = field_config[:regex]
    end
    # Carry over TF validation rules
    (var["validation_rules"] || []).each do |rule|
      if rule["condition"]&.include?("regex")
        regex_match = rule["condition"].match(/\"([^"]+)\"/)
        validation["regex"] ||= regex_match[1] if regex_match
      end
    end
    validation
  end

  def determine_ownership
    return "platform" if @draft.owner_id.nil? && @draft.owner_type.nil?
    return "reseller" if @draft.owner_type == "LocalReseller"
    "customer"
  end

  def determine_visibility
    return "global" if @draft.owner_id.nil? && @draft.owner_type.nil?
    return "reseller" if @draft.owner_type == "LocalReseller"
    "customer"
  end

  def infer_platform_source(name)
    case name
    when "tags" then "tags"
    when "environment" then "env_name"
    when "name_prefix", "name" then "resource_name"
    when "region", "aws_region" then "region"
    end
  end
end
