# frozen_string_literal: true

require "rails_helper"

RSpec.describe LayerPartitioner do
  let(:env) { create(:local_environment, cloud_provider: "aws", aws_account_id: "123456789012", env_type: "dev") }

  describe "#partition" do
    context "with no resources" do
      it "returns an empty array" do
        result = described_class.new(env).partition
        expect(result).to eq([])
      end
    end

    context "with independent resources (no dependencies)" do
      it "places all resources in layer 0" do
        mod = create(:module_definition, provider_dependencies: ["aws"])
        create(:resource, local_environment: env, module_definition: mod)
        create(:resource, local_environment: env, module_definition: mod)

        layers = described_class.new(env).partition

        expect(layers.size).to eq(1)
        expect(layers.first.index).to eq(0)
        expect(layers.first.resources.size).to eq(2)
      end

      it "sets correct state_key" do
        mod = create(:module_definition, provider_dependencies: ["aws"])
        create(:resource, local_environment: env, module_definition: mod)

        layers = described_class.new(env).partition

        expect(layers.first.state_key).to eq("aws/123456789012/dev/layer_0.tfstate")
      end
    end

    context "with a dependency chain" do
      it "places dependent resources in later layers" do
        mod_a = create(:module_definition, provider_dependencies: ["aws"])
        mod_b = create(:module_definition, provider_dependencies: ["aws"])

        res_a = create(:resource, local_environment: env, module_definition: mod_a)
        res_b = create(:resource, local_environment: env, module_definition: mod_b)

        # res_b depends on res_a
        create(:connection, from_resource: res_b, to_resource: res_a, connection_type: "dependency")

        layers = described_class.new(env).partition

        expect(layers.size).to eq(2)
        expect(layers[0].resources).to include(res_a)
        expect(layers[1].resources).to include(res_b)
      end
    end

    context "with circular dependencies" do
      it "raises CircularDependencyError" do
        mod = create(:module_definition, provider_dependencies: ["aws"])
        res_a = create(:resource, local_environment: env, module_definition: mod)
        res_b = create(:resource, local_environment: env, module_definition: mod)

        create(:connection, from_resource: res_a, to_resource: res_b, connection_type: "dependency")
        create(:connection, from_resource: res_b, to_resource: res_a, connection_type: "dependency")

        expect { described_class.new(env).partition }
          .to raise_error(LayerPartitioner::CircularDependencyError, /Circular dependency/)
      end
    end

    context "with provider-based layer constraints" do
      it "places kubernetes-dependent resources after cluster resources" do
        cluster_mod = create(:module_definition, provider_dependencies: ["aws"])
        k8s_mod = create(:module_definition, provider_dependencies: %w[aws kubernetes helm])

        cluster_res = create(:resource, local_environment: env, module_definition: cluster_mod)
        k8s_res = create(:resource, local_environment: env, module_definition: k8s_mod)

        # k8s_res depends on cluster_res
        create(:connection, from_resource: k8s_res, to_resource: cluster_res, connection_type: "dependency")

        layers = described_class.new(env).partition

        cluster_layer = layers.find { |l| l.resources.include?(cluster_res) }
        k8s_layer = layers.find { |l| l.resources.include?(k8s_res) }

        expect(k8s_layer.index).to be > cluster_layer.index
        expect(k8s_layer.required_providers).to include("kubernetes", "helm")
      end
    end

    context "required_providers" do
      it "collects providers from all resources in a layer" do
        mod = create(:module_definition, provider_dependencies: %w[aws tls])
        create(:resource, local_environment: env, module_definition: mod)

        layers = described_class.new(env).partition

        expect(layers.first.required_providers).to include("aws", "tls")
      end
    end
  end
end
