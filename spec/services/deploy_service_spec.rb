# frozen_string_literal: true

require "rails_helper"

RSpec.describe DeployService do
  let(:env) { create(:local_environment) }
  let(:user) { OpenStruct.new(uuid: SecureRandom.uuid) }
  let(:dispatcher) { instance_double(JobDispatcher) }
  let(:ir_builder) { instance_double(IRBuilder) }
  let(:ir_payload) do
    {
      environment: { cloud_provider: "aws", region: "eu-west-1", iac_engine: "opentofu" },
      credentials: { aws_account_id: "123456789012" },
      backend: { type: "s3", bucket: "f50-tfstate", key: "k", region: "eu-west-1" },
      modules: [], layer_context: {}, git_credentials: [], tags: {},
      callback_url: "http://localhost:3000/api/callbacks/deployments/1"
    }
  end

  before do
    allow(JobDispatcher).to receive(:new).and_return(dispatcher)
    allow(IRBuilder).to receive(:new).and_return(ir_builder)
    allow(ir_builder).to receive(:build_for_layer).and_return(ir_payload)
    allow(dispatcher).to receive(:dispatch_plan).and_return(SecureRandom.uuid)
    allow(dispatcher).to receive(:dispatch_deploy).and_return(SecureRandom.uuid)
  end

  describe "#trigger_plan" do
    before do
      mod = create(:module_definition, provider_dependencies: ["aws"])
      create(:resource, local_environment: env, module_definition: mod)
    end

    it "creates a deployment with layers" do
      service = described_class.new(env, user)
      deployment = service.trigger_plan

      expect(deployment).to be_persisted
      expect(deployment.status).to eq("planning")
      expect(deployment.deployment_layers.count).to be >= 1
    end

    it "dispatches the first layer plan job" do
      service = described_class.new(env, user)
      service.trigger_plan

      expect(dispatcher).to have_received(:dispatch_plan).once
    end
  end

  describe "#trigger_deploy" do
    it "raises if deployment is not approved" do
      deployment = create(:deployment, local_environment: env, approval_status: nil)
      service = described_class.new(env, user)

      expect { service.trigger_deploy(deployment) }
        .to raise_error(DeployService::DeployError, /must be approved/)
    end

    it "dispatches deploy for approved deployment" do
      deployment = create(:deployment, local_environment: env, approval_status: "approved")
      create(:deployment_layer, deployment: deployment, index: 0, state_key: "k0")

      service = described_class.new(env, user)
      service.trigger_deploy(deployment)

      expect(dispatcher).to have_received(:dispatch_deploy).once
      expect(deployment.reload.status).to eq("applying")
    end
  end

  describe "#on_layer_completed" do
    let(:deployment) { create(:deployment, local_environment: env, total_layers: 2) }
    let!(:layer_0) { create(:deployment_layer, deployment: deployment, index: 0, state_key: "k0", status: "completed") }
    let!(:layer_1) { create(:deployment_layer, deployment: deployment, index: 1, state_key: "k1", status: "pending") }

    it "dispatches the next layer when current layer completes" do
      service = described_class.new(env, user)
      service.on_layer_completed(deployment, layer_0, action: "plan")

      expect(dispatcher).to have_received(:dispatch_plan).once
      expect(deployment.reload.current_layer).to eq(1)
    end

    it "finalizes deployment when last layer completes" do
      service = described_class.new(env, user)
      service.on_layer_completed(deployment, layer_1, action: "deploy")

      expect(deployment.reload.status).to eq("completed")
      expect(deployment.completed_at).to be_present
    end
  end

  describe "#on_layer_failed" do
    let(:deployment) { create(:deployment, local_environment: env, total_layers: 3) }
    let!(:layer_0) { create(:deployment_layer, deployment: deployment, index: 0, state_key: "k0", status: "failed", error_details: "timeout") }
    let!(:layer_1) { create(:deployment_layer, deployment: deployment, index: 1, state_key: "k1", status: "pending") }
    let!(:layer_2) { create(:deployment_layer, deployment: deployment, index: 2, state_key: "k2", status: "pending") }

    it "skips subsequent layers and fails the deployment" do
      service = described_class.new(env, user)
      service.on_layer_failed(deployment, layer_0)

      expect(layer_1.reload.status).to eq("skipped")
      expect(layer_2.reload.status).to eq("skipped")
      expect(deployment.reload.status).to eq("failed")
    end
  end
end
