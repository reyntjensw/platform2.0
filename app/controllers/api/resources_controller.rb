# frozen_string_literal: true

module Api
  class ResourcesController < BaseController
    before_action :set_resource, only: [:update, :destroy, :properties, :upgrade]

    # GET /api/environments/:environment_id/resources
    def index
      resources = @environment.resources
                    .includes(:module_definition, :outgoing_connections, :incoming_connections,
                              module_definition: [:module_fields, :module_outputs, :module_renderers])
      render json: resources.map { |r| serialize_resource(r) }
    end

    # POST /api/environments/:environment_id/resources
    def create
      mod = ModuleDefinition.find(params[:module_definition_id])

      unless mod.cloud_provider.in?([@environment.cloud_provider, "multi"])
        return render_error("Module #{mod.display_name} is not available for #{@environment.cloud_provider}")
      end

      customer = @environment.local_project&.local_customer
      zone = params[:zone] || AutoPlacementService.determine_zone(mod, customer)

      validation = PlacementValidatorService.validate(mod, zone, customer)
      unless validation.valid
        return render json: {
          error: validation.errors.map { |e| e[:message] }.join(", "),
          violations: validation.errors
        }, status: :unprocessable_entity
      end

      resource = @environment.resources.build(
        module_definition: mod,
        zone: zone,
        position_x: params[:position_x] || rand(100..500).to_f,
        position_y: params[:position_y] || rand(100..400).to_f,
        application_group_id: params[:application_group_id]
      )

      if resource.save
        render json: serialize_resource(resource).merge(warnings: validation.warnings), status: :created
      else
        render_error(resource.errors.full_messages.join(", "))
      end
    end

    # PATCH /api/environments/:environment_id/resources/:id
    def update
      permitted = {}
      permitted[:config] = normalize_config(params[:config]) if params[:config].present?
      permitted[:position_x] = params[:position_x] if params[:position_x].present?
      permitted[:position_y] = params[:position_y] if params[:position_y].present?
      permitted[:zone] = params[:zone] if params[:zone].present?
      permitted[:name] = params[:name] if params[:name].present?
      permitted[:application_group_id] = params[:application_group_id] if params.key?(:application_group_id)
      permitted[:upgrade_available] = params[:upgrade_available] if params.key?(:upgrade_available)

      if permitted[:config]
        errors = FieldValidationService.validate(@resource.module_definition, permitted[:config])
        @resource.validation_errors = errors if errors.any?
      end

      if permitted[:zone] && permitted[:zone] != @resource.zone
        customer = @environment.local_project&.local_customer
        validation = PlacementValidatorService.validate(@resource.module_definition, permitted[:zone], customer)
        unless validation.valid
          return render json: {
            error: validation.errors.map { |e| e[:message] }.join(", "),
            violations: validation.errors
          }, status: :unprocessable_entity
        end
      end

      if @resource.update(permitted)
        render json: serialize_resource(@resource)
      else
        render_error(@resource.errors.full_messages.join(", "))
      end
    end

    # DELETE /api/environments/:environment_id/resources/:id
    def destroy
      @resource.destroy!
      head :no_content
    end

    # GET /api/environments/:environment_id/resources/:id/properties
    def properties
      # Auto-resolve any unresolved dependency fields from existing connections
      resolve_pending_dependencies(@resource)
      @resource.reload
      render partial: "environments/properties", locals: { resource: @resource }
    end

    # POST /api/environments/:environment_id/resources/:id/upgrade
    # Upgrades a resource to the latest module version.
    # Accepts new_config values for any new required fields introduced by the upgrade.
    def upgrade
      unless current_user&.platform_admin? || current_user&.reseller_admin? || current_user&.customer_admin?
        return render_error("You don't have permission to upgrade resources", status: :forbidden)
      end

      env = @resource.local_environment
      if env.upgrade_policy == "locked"
        return render_error("Environment #{env.name} is locked — upgrades not allowed", status: :forbidden)
      end

      renderer = @resource.module_definition.module_renderers.first
      unless renderer
        return render_error("No renderer found for this module")
      end

      latest_version = renderer.module_versions.published.recent.first
      unless latest_version
        return render_error("No published version available")
      end

      # Merge new field values from the request into the resource config
      new_config = params[:new_config]&.to_unsafe_h || {}
      merged_config = (@resource.config || {}).merge(new_config)

      # Validate that all new required fields have values
      report = @resource.upgrade_report || latest_version.compatibility_report || {}
      missing = []
      (report["added"] || []).each do |added_var|
        next unless added_var["breaking"] # only required fields with no default
        unless merged_config[added_var["name"]].present?
          missing << added_var["name"]
        end
      end

      if missing.any?
        return render_error("Missing required fields: #{missing.join(', ')}")
      end

      @resource.update!(
        renderer_ref: latest_version.version_ref,
        config: merged_config,
        upgrade_available: false,
        upgrade_report: {}
      )

      render json: serialize_resource(@resource)
    end

    private

    def set_resource
      @resource = @environment.resources.find(params[:id])
    rescue ActiveRecord::RecordNotFound
      render_error("Resource not found", status: :not_found)
    end

    # Resolves dependency fields that have active connections but no config value yet.
    # This handles cases where the connection was created before dependency_config was set,
    # or where the auto-resolve at connection time couldn't match outputs.
    def resolve_pending_dependencies(resource)
      dep_fields = resource.module_definition.module_fields.dependency
      return if dep_fields.empty?

      config = resource.config || {}
      changed = false

      resource.outgoing_connections.includes(to_resource: :module_definition).each do |conn|
        to_resource = conn.to_resource
        to_mod = to_resource.module_definition
        to_ref = terraform_module_ref(to_resource)

        dep_fields.each do |field|
          next if config[field.name].present? # already resolved

          dep_cfg = field.dependency_config || {}
          target_module = dep_cfg["source_module"] || dep_cfg["dependency_module"]
          target_output = dep_cfg["source_output"] || dep_cfg["dependency_output"]

          # Check if this connection's target module matches the dependency config
          matches = if target_module.present?
            to_mod.name == target_module
          else
            to_mod.module_outputs.exists?(name: target_output.presence || field.name)
          end

          next unless matches

          output_name = target_output.presence || field.name
          config[field.name] = "#{to_ref}.#{output_name}"
          changed = true
        end
      end

      resource.update!(config: config) if changed
    end

    def terraform_module_ref(resource)
      module_key = resource.module_definition.name
      identifier = resource.name
      sanitized = identifier.gsub(/[^a-zA-Z0-9_-]/i, "_").downcase
      "module.#{module_key}_#{sanitized}"
    end

    # Converts ActionController::Parameters to a plain hash,
    # preserving arrays that to_unsafe_h would convert to {"0"=>"a","1"=>"b"}.
    def normalize_config(config_params)
      JSON.parse(config_params.to_json)
    rescue JSON::ParserError
      config_params.to_unsafe_h
    end

    def serialize_resource(resource)
      {
        id: resource.id,
        name: resource.name,
        zone: resource.zone,
        config: resource.config,
        validation_errors: resource.validation_errors,
        position_x: resource.position_x,
        position_y: resource.position_y,
        application_group_id: resource.application_group_id,
        upgrade_available: resource.upgrade_available?,
        upgrade_report: resource.upgrade_report,
        renderer_ref: resource.renderer_ref,
        created_at: resource.created_at,
        module_definition: {
          id: resource.module_definition.id,
          name: resource.module_definition.name,
          display_name: resource.module_definition.display_name,
          icon: resource.module_definition.icon,
          category: resource.module_definition.category,
          cloud_provider: resource.module_definition.cloud_provider,
          allowed_zones: resource.module_definition.allowed_zones,
          deployable: resource.module_definition.deployable?,
          version: resource.module_definition.version
        },
        fields: resource.module_definition.module_fields.ordered.map { |f|
          {
            name: f.name, label: f.label, field_type: f.field_type,
            classification: f.classification, required: f.required?,
            default_value: f.default_value, validation: f.validation,
            group: f.group, position: f.position, data_source: f.data_source
          }
        },
        connections: {
          outgoing: resource.outgoing_connections.map { |c| { id: c.id, to_resource_id: c.to_resource_id, type: c.connection_type } },
          incoming: resource.incoming_connections.map { |c| { id: c.id, from_resource_id: c.from_resource_id, type: c.connection_type } }
        }
      }
    end
  end
end
