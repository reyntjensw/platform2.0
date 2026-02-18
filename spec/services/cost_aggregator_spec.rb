# frozen_string_literal: true

require "rails_helper"

RSpec.describe CostAggregator do
  let(:env) { create(:local_environment) }
  let(:deployment) { create(:deployment, local_environment: env, total_layers: 2) }

  before do
    create(:deployment_layer, deployment: deployment, index: 0, state_key: "k0",
           cost_estimate: { "totalMonthlyCost" => "100.50", "totalHourlyCost" => "0.137671", "currency" => "USD" })
    create(:deployment_layer, deployment: deployment, index: 1, state_key: "k1",
           cost_estimate: { "totalMonthlyCost" => "50.25", "totalHourlyCost" => "0.068836", "currency" => "USD" })
  end

  describe ".aggregate" do
    it "sums monthly and hourly costs across layers" do
      result = described_class.aggregate(deployment)

      expect(result["totalMonthlyCost"]).to eq("150.75")
      expect(result["totalHourlyCost"]).to eq("0.206507")
      expect(result["currency"]).to eq("USD")
    end

    it "includes per-layer breakdown" do
      result = described_class.aggregate(deployment)

      expect(result["layers"].size).to eq(2)
      expect(result["layers"].first["layer_index"]).to eq(0)
      expect(result["layers"].last["layer_index"]).to eq(1)
    end

    it "handles layers with no cost estimate" do
      create(:deployment_layer, deployment: deployment, index: 2, state_key: "k2", cost_estimate: {})
      result = described_class.aggregate(deployment)

      # Should still only include the 2 layers with costs
      expect(result["layers"].size).to eq(2)
      expect(result["totalMonthlyCost"]).to eq("150.75")
    end
  end
end
