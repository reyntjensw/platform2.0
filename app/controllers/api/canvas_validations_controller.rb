# frozen_string_literal: true

module Api
  class CanvasValidationsController < BaseController
    # GET /api/environments/:environment_id/canvas_validations
    # Returns combined validation results for the Valid tab:
    #   - Pre-deployment checks (cloud account, business rules, encryption, etc.)
    #   - Per-resource field validation errors (required fields, type checks)
    def show
      checks = pre_deployment_checks
      resource_issues = resource_field_validations

      all_items = checks + resource_issues
      error_count = all_items.count { |i| i[:severity] == "error" }
      warning_count = all_items.count { |i| i[:severity] == "warning" }

      render json: {
        items: all_items,
        summary: { errors: error_count, warnings: warning_count, total: all_items.size }
      }
    end

    private

    def pre_deployment_checks
      service = PreDeploymentCheckService.new(@environment)
      result = service.run

      result.checks.map do |check|
        {
          type: "pre_deploy",
          severity: check.status == :failed ? "error" : "ok",
          title: check.name,
          message: check.message
        }
      end
    end

    def resource_field_validations
      items = []
      resources = @environment.resources.includes(:module_definition)

      resources.find_each do |resource|
        config = resource.config || {}
        errors = FieldValidationService.validate(resource.module_definition, config)

        errors.each do |field_name, messages|
          messages.each do |msg|
            items << {
              type: "field",
              severity: "error",
              title: "#{resource.name}: #{field_name} #{msg}",
              message: "Module: #{resource.module_definition.display_name}",
              resource_id: resource.id,
              resource_name: resource.name,
              field: field_name
            }
          end
        end
      end

      items
    end
  end
end
