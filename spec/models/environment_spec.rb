# frozen_string_literal: true

require "rails_helper"

RSpec.describe Environment do
  subject(:environment) do
    described_class.new(
      uuid: "env-1",
      project_uuid: "proj-1",
      name: "Development",
      environment_type: "dev",
      provider: "aws",
      region: "eu-west-1"
    )
  end

  it "includes ApiBacked" do
    expect(described_class.ancestors).to include(ApiBacked)
  end

  describe "CS Internal API attributes" do
    it "has core attributes" do
      expect(environment.uuid).to eq("env-1")
      expect(environment.project_uuid).to eq("proj-1")
      expect(environment.name).to eq("Development")
      expect(environment.environment_type).to eq("dev")
      expect(environment.provider).to eq("aws")
      expect(environment.region).to eq("eu-west-1")
    end

    it "has account/subscription attributes" do
      e = described_class.new(account_id: "111111111111", subscription_id: "sub-abc")
      expect(e.account_id).to eq("111111111111")
      expect(e.subscription_id).to eq("sub-abc")
    end
  end

  describe "Platform API merged attributes" do
    it "defaults boolean flags to false" do
      e = described_class.new
      expect(e.finops_enabled).to be false
      expect(e.secops_enabled).to be false
      expect(e.monitoring_enabled).to be false
    end

    it "accepts platform API fields" do
      e = described_class.new(
        finops_enabled: true,
        secops_enabled: true,
        monitoring_enabled: true,
        aws_role_arn: "arn:aws:iam::111:role/f50",
        azure_subscription_id: "sub-123"
      )
      expect(e.finops_enabled).to be true
      expect(e.secops_enabled).to be true
      expect(e.monitoring_enabled).to be true
      expect(e.aws_role_arn).to eq("arn:aws:iam::111:role/f50")
      expect(e.azure_subscription_id).to eq("sub-123")
    end
  end

  describe "#to_param" do
    it "returns the uuid" do
      expect(environment.to_param).to eq("env-1")
    end
  end

  describe "#persisted?" do
    it "returns true when uuid is present" do
      expect(environment.persisted?).to be true
    end

    it "returns false when uuid is blank" do
      expect(described_class.new.persisted?).to be false
    end
  end

  describe ".from_api" do
    it "builds from a hash, ignoring unknown keys" do
      e = described_class.from_api(uuid: "x", name: "Test", project_uuid: "p", garbage: true)
      expect(e.uuid).to eq("x")
      expect(e.project_uuid).to eq("p")
    end
  end
end
