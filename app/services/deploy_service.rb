# frozen_string_literal: true

class DeployService
  def initialize(environment, user)
    @environment = environment
    @user = user
    @pipeline = PipelineClient.new
  end

  def trigger_plan
    deployment = @environment.deployments.create!(
      triggered_by_uuid: @user.uuid,
      status: "pending"
    )

    ir = IRBuilder.new(@environment).build(deployment)

    result = @pipeline.plan(ir)

    if result[:success]
      deployment.update!(status: "dispatched")
    else
      deployment.update!(status: "failed", plan_output: result[:error])
    end

    deployment
  end

  def trigger_deploy
    deployment = @environment.deployments.create!(
      triggered_by_uuid: @user.uuid,
      status: "pending"
    )

    ir = IRBuilder.new(@environment).build(deployment)

    result = @pipeline.deploy(ir)

    if result[:success]
      deployment.update!(status: "dispatched")
    else
      deployment.update!(status: "failed", plan_output: result[:error])
    end

    deployment
  end
end
