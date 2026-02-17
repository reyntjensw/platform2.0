# frozen_string_literal: true

module Api
  class ResourcesController < BaseController
    before_action :set_resource, only: [:update, :destroy, :properties]

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
      permitted[:config] = params[:config].to_unsafe_h if params[:config].present?
      permitted[:position_x] = params[:position_x] if params[:position_x].present?
      permitted[:position_y] = params[:position_y] if params[:position_y].present?
      permitted[:zone] = params[:zone] if params[:zone].present?
      permitted[:name] = params[:name] if params[:name].present?
      permitted[:application_group_id] = params[:application_group_id] if params.key?(:application_group_id)

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
      render partial: "environments/properties", locals: { resource: @resource }
    end

    private

    def set_resource
      @resource = @environment.resources.find(params[:id])
    rescue ActiveRecord::RecordNotFound
      render_error("Resource not found", status: :not_found)
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
        created_at: resource.created_at,
        module_definition: {
          id: resource.module_definition.id,
          name: resource.module_definition.name,
          display_name: resource.module_definition.display_name,
          icon: resource.module_definition.icon,
          category: resource.module_definition.category,
          cloud_provider: resource.module_definition.cloud_provider,
          allowed_zones: resource.module_definition.allowed_zones,
          deployable: resource.module_definition.deployable?
        },
        fields: resource.module_definition.module_fields.ordered.map { |f|
          {
            name: f.name, label: f.label, field_type: f.field_type,
            classification: f.classification, required: f.required?,
            default_value: f.default_value, validation: f.validation,
            group: f.group, position: f.position
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
