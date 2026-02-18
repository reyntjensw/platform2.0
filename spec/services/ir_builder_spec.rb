# frozen_string_literal: true

require "rails_helper"

RSpec.describe IRBuilder do
  let(:reseller) { create(:local_reseller) }
  let(:customer) { create(:local_customer, local_reseller: reseller) }
  let(:project) { create(:local_project, local_customer: customer) }
  let(:env) do
    create(:local_environment, local_project: project,
           cloud_provider: "aws", region: "eu-west-1",
           aws_account_id: "123456789012", env_type: "dev")
  end
  let(:deployment) { create(:deployment, local_environment: env) }

  describe "#build_for_layer" do
    let(:mod_def) { create(:module_definition, provider_dependencies: ["aws"]) }
    let!(:renderer) { create(:module_renderer, module_definition: mod_def, engine: "opentofu") }
    let(:resource) { create(:resource, local_environment: env, module_definition: mod_def) }
    let(:layer) do
      create(:deployment_layer, deployment: deployment, index: 0,
             resource_ids: [resource.id],
             required_providers: ["aws"],
             remote_state_refs: [],
             state_key: "aws/123456789012/dev/layer_0.tfstate")
    end

    before do
      allow(EnvironmentCredentialsService).to receive(:fetch_aws).and_return(
        { role_arn: "arn:aws:iam::123456789012:role/FactorFifty-onboarding", external_id: "test-ext-id" }
      )
    end

    it "returns a hash with all required keys" do
      ir = described_class.new(env).build_for_layer(deployment, layer)

      expect(ir).to include(:environment, :credentials, :backend, :tags, :modules,
                            :layer_context, :git_credentials, :callback_url)
    end

    it "uses the layer state_key in backend config" do
      ir = described_class.new(env).build_for_layer(deployment, layer)

      expect(ir[:backend][:key]).to eq("aws/123456789012/dev/layer_0.tfstate")
    end

    it "includes iac_engine in environment block" do
      ir = described_class.new(env).build_for_layer(deployment, layer)

      expect(ir[:environment][:iac_engine]).to eq("opentofu")
    end

    it "builds layer_context with correct fields" do
      ir = described_class.new(env).build_for_layer(deployment, layer)

      expect(ir[:layer_context][:layer_index]).to eq(0)
      expect(ir[:layer_context][:required_providers]).to eq(["aws"])
      expect(ir[:layer_context][:state_key]).to eq(layer.state_key)
    end

    it "includes only the layer's resources in modules" do
      other_mod = create(:module_definition, provider_dependencies: ["aws"])
      create(:module_renderer, module_definition: other_mod, engine: "opentofu")
      create(:resource, local_environment: env, module_definition: other_mod)

      ir = described_class.new(env).build_for_layer(deployment, layer)

      resource_ids = ir[:modules].map { |m| m[:resource_id] }
      expect(resource_ids).to eq([resource.id])
    end

    it "includes callback_url pointing to the deployment" do
      ir = described_class.new(env).build_for_layer(deployment, layer)

      expect(ir[:callback_url]).to include(deployment.id)
    end
  end
end
