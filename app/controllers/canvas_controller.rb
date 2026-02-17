# frozen_string_literal: true

class CanvasController < AuthenticatedController
  layout "canvas"

  # GET /canvas/:id
  def show
    @environment = LocalEnvironment.includes(
      :local_project,
      resources: [:module_definition, :outgoing_connections, :incoming_connections]
    ).find(params[:id])

    @project = @environment.local_project
    @customer = @project.local_customer
    @sibling_envs = @project.local_environments.order(:env_type)

    @catalog_modules = ModuleDefinition.for_environment(@environment)
                         .includes(:module_fields, :module_renderers)
                         .order(:category, :display_name)

    # Preload data for client-side rendering
    @resources_json = @environment.resources.includes(
      :module_definition, :outgoing_connections, :incoming_connections
    ).map { |r| serialize_resource(r) }.to_json

    @connections_json = Connection.where(
      from_resource: @environment.resources
    ).or(
      Connection.where(to_resource: @environment.resources)
    ).map { |c| { id: c.id, from_resource_id: c.from_resource_id, to_resource_id: c.to_resource_id, connection_type: c.connection_type } }.to_json
  end

  private

  def serialize_resource(r)
    {
      id: r.id,
      name: r.name,
      config: r.config,
      zone: r.zone,
      position_x: r.position_x || 0,
      position_y: r.position_y || 0,
      validation_errors: r.validation_errors,
      application_group_id: r.application_group_id,
      module_definition: {
        id: r.module_definition.id,
        name: r.module_definition.name,
        display_name: r.module_definition.display_name,
        icon: r.module_definition.icon,
        category: r.module_definition.category,
        cloud_provider: r.module_definition.cloud_provider,
        deployable: r.module_definition.deployable?,
        allowed_zones: r.module_definition.allowed_zones
      },
      connections: {
        outgoing: r.outgoing_connections.map { |c| { id: c.id, to_resource_id: c.to_resource_id, connection_type: c.connection_type } },
        incoming: r.incoming_connections.map { |c| { id: c.id, from_resource_id: c.from_resource_id, connection_type: c.connection_type } }
      }
    }
  end
end
