# frozen_string_literal: true

module Api
  class ConnectionsController < BaseController
    # POST /api/environments/:environment_id/connections
    def create
      from = @environment.resources.find(params[:from_resource_id])
      to = @environment.resources.find(params[:to_resource_id])

      connection = Connection.new(
        from_resource: from,
        to_resource: to,
        connection_type: params[:connection_type] || "dependency"
      )

      if connection.save
        # Auto-resolve dependency fields on the "from" resource that match the "to" resource's module
        resolved_fields = resolve_dependency_fields(from, to)

        AuditLogService.record(
          action: "created", resource_type: "Connection",
          resource_uuid: connection.id.to_s,
          metadata: {
            from_resource_id: connection.from_resource_id,
            to_resource_id: connection.to_resource_id,
            connection_type: connection.connection_type,
            environment: @environment.name
          }
        )

        render json: {
          id: connection.id,
          from_resource_id: connection.from_resource_id,
          to_resource_id: connection.to_resource_id,
          connection_type: connection.connection_type,
          resolved_fields: resolved_fields
        }, status: :created
      else
        render_error(connection.errors.full_messages.join(", "))
      end
    rescue ActiveRecord::RecordNotFound
      render_error("Resource not found", status: :not_found)
    end

    # DELETE /api/environments/:environment_id/connections/:id
    def destroy
      connection = Connection.find(params[:id])
      from_resource = connection.from_resource

      # Clear dependency fields that were resolved from this connection
      clear_dependency_fields(from_resource, connection.to_resource)

      conn_id = connection.id.to_s
      conn_meta = {
        from_resource_id: connection.from_resource_id,
        to_resource_id: connection.to_resource_id,
        connection_type: connection.connection_type,
        environment: @environment.name
      }

      connection.destroy!

      AuditLogService.record(
        action: "deleted", resource_type: "Connection",
        resource_uuid: conn_id,
        metadata: conn_meta
      )

      head :no_content
    rescue ActiveRecord::RecordNotFound
      render_error("Connection not found", status: :not_found)
    end

    private

    # Resolves dependency fields on the "from" resource using the "to" resource's module outputs.
    # Returns a hash of { field_name => resolved_value } for fields that were updated.
    def resolve_dependency_fields(from_resource, to_resource)
      dep_fields = from_resource.module_definition.module_fields.dependency
      return {} if dep_fields.empty?

      to_mod = to_resource.module_definition
      to_ref = terraform_module_ref(to_resource)
      to_output_names = to_mod.module_outputs.pluck(:name)
      resolved = {}

      dep_fields.each do |field|
        dep_config = field.dependency_config || {}
        target_module = dep_config["source_module"] || dep_config["dependency_module"]
        target_output = dep_config["source_output"] || dep_config["dependency_output"]

        # Determine if this dependency field matches the target resource's module
        matches = if target_module.present?
          to_mod.name == target_module
        else
          # No explicit module target — try to match by:
          # 1. Explicit output name from config
          # 2. Field name matches an output on the target module
          output_to_check = target_output.presence || field.name
          to_output_names.include?(output_to_check)
        end

        next unless matches

        # Determine which output to reference
        output_name = target_output.presence || field.name

        # When both source_module and source_output are explicitly configured,
        # trust the config and build the reference even if the output isn't
        # catalogued in module_outputs (the actual Terraform module may have it).
        if to_output_names.include?(output_name) || (target_module.present? && target_output.present?)
          ref_value = "#{to_ref}.#{output_name}"
          config = from_resource.config || {}
          config[field.name] = ref_value
          from_resource.update!(config: config)
          resolved[field.name] = ref_value
        end
      end

      resolved
    end

    # Clears dependency fields that were resolved from a specific target resource.
    def clear_dependency_fields(from_resource, to_resource)
      dep_fields = from_resource.module_definition.module_fields.dependency
      return if dep_fields.empty?

      to_ref_prefix = terraform_module_ref(to_resource)
      config = from_resource.config || {}
      changed = false

      dep_fields.each do |field|
        val = config[field.name]
        if val.is_a?(String) && val.start_with?(to_ref_prefix)
          config[field.name] = nil
          changed = true
        end
      end

      from_resource.update!(config: config) if changed
    end

    # Builds the Terraform module reference for a resource.
    # Must match the naming convention in main.tf.jinja2:
    #   module "{{ module.moduleKey }}_{{ identifier | sanitize }}"
    # where sanitize = re.sub(r'[^a-zA-Z0-9_-]', '_', s).lower()
    def terraform_module_ref(resource)
      module_key = resource.module_definition.name
      identifier = resource.name
      sanitized = identifier.gsub(/[^a-zA-Z0-9_-]/i, "_").downcase
      "module.#{module_key}_#{sanitized}"
    end
  end
end
