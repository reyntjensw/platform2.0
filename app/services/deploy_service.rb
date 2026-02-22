# frozen_string_literal: true

class DeployService
  class DeployError < StandardError; end

  def initialize(environment, user)
    @environment = environment
    @user = user
    @dispatcher = JobDispatcher.new
    @partitioner = LayerPartitioner.new(environment)
  end

  # Triggers a plan for all layers. Runs pre-deployment checks first,
  # then dispatches layer 0 immediately; subsequent layers are dispatched
  # by on_layer_completed callback.
  #
  # @return [Deployment]
  def trigger_plan
    pre_check = PreDeploymentCheckService.new(@environment).run
    unless pre_check.passed
      failures = pre_check.blocking_failures.map(&:message).join("; ")
      raise DeployError, "Pre-deployment checks failed: #{failures}"
    end

    layers = @partitioner.partition
    deployment = create_deployment(layers, pre_check_results: pre_check.checks)

    if deployment.deployment_layers.any?
      dispatch_layer_plan(deployment, deployment.deployment_layers.ordered.first)
    else
      deployment.update!(status: "completed", completed_at: Time.current)
    end

    AuditLogService.record(
      action: "deployed",
      resource_type: "Environment",
      resource_uuid: @environment.id.to_s,
      metadata: { deployment_id: deployment.id, version: deployment.version, layers: deployment.total_layers,
                  environment_name: @environment.name },
      user: @user
    )

    deployment
  rescue LayerPartitioner::CircularDependencyError => e
    deployment&.update!(status: "failed", result: { error: e.message })
    deployment || raise
  rescue JobDispatcher::DispatchError => e
    deployment&.update!(status: "failed", result: { error: e.message })
    deployment || raise
  end

  # Triggers deploy (apply) for an approved deployment.
  # Dispatches layer 0; subsequent layers via callbacks.
  #
  # @param deployment [Deployment]
  # @return [Deployment]
  def trigger_deploy(deployment)
    unless deployment.approved?
      raise DeployError, "Deployment must be approved before deploying"
    end

    deployment.update!(status: "applying", current_layer: 0)
    deployment.deployment_layers.ordered.each { |l| l.update!(status: "pending") }

    first_layer = deployment.deployment_layers.ordered.first
    dispatch_layer_deploy(deployment, first_layer) if first_layer

    deployment
  end

  # Called when a layer completes (from callback controller).
  # Dispatches the next layer or finalizes the deployment.
  #
  # @param deployment [Deployment]
  # @param completed_layer [DeploymentLayer]
  # @param action [String] "plan" or "deploy"
  def on_layer_completed(deployment, completed_layer, action:)
    next_layer = deployment.deployment_layers
                           .where("index > ?", completed_layer.index)
                           .ordered.first

    if next_layer
      deployment.update!(current_layer: next_layer.index)
      if action == "plan"
        dispatch_layer_plan(deployment, next_layer)
      else
        dispatch_layer_deploy(deployment, next_layer)
      end
    else
      finalize_deployment(deployment, action)
    end
  end

  # Called when a layer fails. Marks subsequent layers as skipped
  # and sets the deployment to failed.
  #
  # @param deployment [Deployment]
  # @param failed_layer [DeploymentLayer]
  def on_layer_failed(deployment, failed_layer)
    # Skip all subsequent layers
    deployment.deployment_layers
              .where("index > ?", failed_layer.index)
              .update_all(status: "skipped")

    deployment.update!(
      status: "failed",
      completed_at: Time.current,
      result: { error: "Layer #{failed_layer.index} failed: #{failed_layer.error_details}" }
    )
  end

  private

  def create_deployment(layer_structs, pre_check_results: nil)
    next_version = (@environment.deployments.maximum(:version) || 0) + 1

    deployment = @environment.deployments.create!(
      triggered_by_uuid: @user.uuid,
      status: "pending",
      version: next_version,
      total_layers: layer_structs.size,
      current_layer: 0,
      result: { pre_deployment_checks: serialize_checks(pre_check_results) }.compact
    )

    layer_structs.each do |layer_struct|
      deployment.deployment_layers.create!(
        index: layer_struct.index,
        resource_ids: layer_struct.resources.map(&:id),
        required_providers: layer_struct.required_providers,
        remote_state_refs: layer_struct.remote_state_refs,
        state_key: layer_struct.state_key,
        status: "pending"
      )
    end

    deployment
  end

  def dispatch_layer_plan(deployment, layer)
    ir = IRBuilder.new(@environment).build_for_layer(deployment, layer)
    job_id = @dispatcher.dispatch_plan(deployment, layer, ir)
    layer.update!(status: "dispatched", job_id: job_id, started_at: Time.current)
    deployment.update!(status: "planning", current_layer: layer.index)
  end

  def dispatch_layer_deploy(deployment, layer)
    ir = IRBuilder.new(@environment).build_for_layer(deployment, layer)
    job_id = @dispatcher.dispatch_deploy(deployment, layer, ir)
    layer.update!(status: "dispatched", job_id: job_id, started_at: Time.current)
    deployment.update!(status: "applying", current_layer: layer.index)
  end

  def finalize_deployment(deployment, action)
    if action == "plan"
      cost_estimate = CostAggregator.aggregate(deployment)
      deployment.update!(
        status: "planned",
        approval_status: "pending_approval",
        cost_estimate: cost_estimate,
        completed_at: Time.current
      )
    else
      deployment.update!(
        status: "completed",
        completed_at: Time.current
      )
    end
  end

  def serialize_checks(checks)
    return nil unless checks

    checks.map do |check|
      { name: check.name, status: check.status.to_s, message: check.message }
    end
  end
end
