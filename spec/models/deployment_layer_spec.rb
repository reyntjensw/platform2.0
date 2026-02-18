# frozen_string_literal: true

require "rails_helper"

RSpec.describe DeploymentLayer, type: :model do
  describe "validations" do
    subject { create(:deployment_layer, deployment: create(:deployment, local_environment: create(:local_environment))) }

    it { is_expected.to validate_presence_of(:index) }
    it { is_expected.to validate_uniqueness_of(:index).scoped_to(:deployment_id) }
    it { is_expected.to validate_presence_of(:state_key) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(DeploymentLayer::STATUSES) }
  end

  describe "associations" do
    it { is_expected.to belong_to(:deployment) }
  end

  describe "status helpers" do
    let(:layer) { build(:deployment_layer) }

    DeploymentLayer::STATUSES.each do |status|
      it "responds to #{status}?" do
        layer.status = status
        expect(layer.send("#{status}?")).to be true
      end
    end
  end

  describe "scopes" do
    let(:env) { create(:local_environment) }
    let(:deployment) { create(:deployment, local_environment: env) }

    it ".ordered returns layers sorted by index" do
      l2 = create(:deployment_layer, deployment: deployment, index: 2, state_key: "k2")
      l0 = create(:deployment_layer, deployment: deployment, index: 0, state_key: "k0")
      l1 = create(:deployment_layer, deployment: deployment, index: 1, state_key: "k1")

      expect(deployment.deployment_layers.ordered).to eq([l0, l1, l2])
    end
  end
end
