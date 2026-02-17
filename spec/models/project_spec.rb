# frozen_string_literal: true

require "rails_helper"

RSpec.describe Project do
  subject(:project) { described_class.new(uuid: "proj-1", customer_uuid: "cust-1", name: "Platform", provider: "aws") }

  it "includes ApiBacked" do
    expect(described_class.ancestors).to include(ApiBacked)
  end

  describe "attributes" do
    it "has expected attributes" do
      p = described_class.new(
        uuid: "proj-1",
        customer_uuid: "cust-1",
        name: "Platform",
        provider: "aws",
        status: "active"
      )
      expect(p.uuid).to eq("proj-1")
      expect(p.customer_uuid).to eq("cust-1")
      expect(p.name).to eq("Platform")
      expect(p.provider).to eq("aws")
      expect(p.status).to eq("active")
    end
  end

  describe "#to_param" do
    it "returns the uuid" do
      expect(project.to_param).to eq("proj-1")
    end
  end

  describe "#persisted?" do
    it "returns true when uuid is present" do
      expect(project.persisted?).to be true
    end

    it "returns false when uuid is blank" do
      expect(described_class.new.persisted?).to be false
    end
  end

  describe ".from_api" do
    it "builds from a hash, ignoring unknown keys" do
      p = described_class.from_api(uuid: "x", name: "Test", customer_uuid: "c", foo: "bar")
      expect(p.uuid).to eq("x")
      expect(p.customer_uuid).to eq("c")
    end
  end
end
