# frozen_string_literal: true

module Api
  class DeploymentsController < BaseController
    before_action :set_deployment, only: [:show, :approve, :reject, :logs, :plan, :infracost]

    # GET /api/environments/:environment_id/deployments/runner_status
    # Returns whether at least one runner is connected and healthy.
    def runner_status
      service = RunnerStatusService.new(account_id: "platform")
      runners = service.list_runners
      connected = runners.any? { |r| r[:live] && r[:status] == "active" }

      render_json({
        connected: connected,
        runner_count: runners.size,
        runners: runners.map { |r| r.slice(:runner_id, :status, :version, :last_heartbeat, :live) }
      })
    end

    # GET /api/environments/:environment_id/deployments/pre_checks
    # Returns pre-deployment check results without triggering a plan.
    def pre_checks
      service = PreDeploymentCheckService.new(@environment)
      result = service.run

      render_json({
        passed: result.passed,
        checks: result.checks.map do |check|
          { name: check.name, status: check.status.to_s, message: check.message }
        end
      })
    end

    # POST /api/environments/:environment_id/deployments
    # Triggers a plan deployment (runs pre-checks, partitions layers, dispatches).
    def create
      authorize!(:manage, @environment)

      deploy_service = DeployService.new(@environment, current_user)
      deployment = deploy_service.trigger_plan

      render_json(serialize_deployment(deployment), status: :created)
    rescue DeployService::DeployError => e
      render_error(e.message, status: :unprocessable_entity)
    end

    # GET /api/environments/:environment_id/deployments/:id
    def show
      # If deployment is in-progress, poll DynamoDB for runner status updates
      if @deployment.in_progress?
        begin
          JobStatusPollerService.new(@deployment).sync!
          @deployment.reload
        rescue => e
          Rails.logger.warn("JobStatusPollerService sync failed: #{e.message}")
        end
      end

      render_json(serialize_deployment(@deployment))
    end

    # PATCH /api/environments/:environment_id/deployments/:id/approve
    def approve
      authorize!(:manage, @environment)

      unless @deployment.approval_status == "pending_approval"
        return render_error(
          "Deployment is not awaiting approval (current: #{@deployment.approval_status || @deployment.status})",
          status: :unprocessable_entity
        )
      end

      @deployment.update!(
        approval_status: "approved",
        approved_by_uuid: current_user.uuid,
        approved_at: Time.current
      )

      deploy_service = DeployService.new(@environment, current_user)
      deploy_service.trigger_deploy(@deployment)

      render_json(serialize_deployment(@deployment.reload))
    rescue DeployService::DeployError => e
      render_error(e.message, status: :unprocessable_entity)
    end

    # PATCH /api/environments/:environment_id/deployments/:id/reject
    def reject
      authorize!(:manage, @environment)

      unless @deployment.approval_status == "pending_approval"
        return render_error(
          "Deployment is not awaiting approval (current: #{@deployment.approval_status || @deployment.status})",
          status: :unprocessable_entity
        )
      end

      @deployment.update!(
        approval_status: "rejected",
        approved_by_uuid: current_user.uuid,
        approved_at: Time.current,
        status: "rejected"
      )

      render_json(serialize_deployment(@deployment.reload))
    end

    # GET /api/environments/:environment_id/deployments/:id/logs
    # Returns execution logs from S3 for a specific layer (or all layers).
    def logs
      layer_index = params[:layer_index]&.to_i
      step_name = params[:step]

      layers = if layer_index
                 @deployment.deployment_layers.where(index: layer_index)
               else
                 @deployment.deployment_layers.ordered
               end

      result = layers.map do |layer|
        log_service = DeploymentLogService.new(@deployment, layer)

        if step_name
          log_content = log_service.fetch_step_log(step_name)
          { layer_index: layer.index, step: step_name, log: log_content }
        else
          all_logs = log_service.fetch_logs
          { layer_index: layer.index, logs: all_logs }
        end
      end

      render_json({ deployment_id: @deployment.id, layers: result })
    end

    # GET /api/environments/:environment_id/deployments/:id/plan
    # Returns the human-readable plan output (tofu show) from S3 for each layer.
    def plan
      layers = @deployment.deployment_layers.ordered

      result = layers.map do |layer|
        log_service = DeploymentLogService.new(@deployment, layer)
        plan_text = log_service.fetch_plan
        { layer_index: layer.index, plan_output: plan_text }
      end

      render_json({ deployment_id: @deployment.id, layers: result })
    end

    # GET /api/environments/:environment_id/deployments/:id/infracost
    # Returns parsed infracost data from S3 for each layer.
    def infracost
      layers = @deployment.deployment_layers.ordered

      result = layers.map do |layer|
        log_service = DeploymentLogService.new(@deployment, layer)
        cost_data = log_service.fetch_infracost
        { layer_index: layer.index, cost_data: cost_data }
      end

      render_json({ deployment_id: @deployment.id, layers: result })
    end

    private

    def set_deployment
      @deployment = @environment.deployments.find(params[:id])
    rescue ActiveRecord::RecordNotFound
      render_error("Deployment not found", status: :not_found)
    end

    def serialize_deployment(deployment)
      {
        id: deployment.id,
        version: deployment.version,
        status: deployment.status,
        approval_status: deployment.approval_status,
        cost_estimate: deployment.cost_estimate,
        result: deployment.result,
        pre_deployment_checks: deployment.result&.dig("pre_deployment_checks"),
        total_layers: deployment.total_layers,
        current_layer: deployment.current_layer,
        triggered_by_uuid: deployment.triggered_by_uuid,
        approved_by_uuid: deployment.approved_by_uuid,
        approved_at: deployment.approved_at,
        completed_at: deployment.completed_at,
        created_at: deployment.created_at,
        layers: deployment.deployment_layers.ordered.map do |layer|
          {
            index: layer.index,
            status: layer.status,
            cost_estimate: layer.cost_estimate,
            plan_output: layer.plan_output,
            error_details: layer.error_details,
            steps: layer.step_details.presence || [],
            started_at: layer.started_at,
            completed_at: layer.completed_at
          }
        end
      }
    end
  end
end
