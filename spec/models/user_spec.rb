# frozen_string_literal: true

require "rails_helper"

RSpec.describe User do
  subject(:user) do
    described_class.new(
      uuid: "user-1",
      sub: "kc-sub-123",
      email: "dev@example.com",
      name: "Dev User",
      reseller_uuid: "res-1",
      roles: %w[reseller_admin]
    )
  end

  it "includes ApiBacked" do
    expect(described_class.ancestors).to include(ApiBacked)
  end

  describe "attributes" do
    it "has expected attributes" do
      expect(user.uuid).to eq("user-1")
      expect(user.sub).to eq("kc-sub-123")
      expect(user.email).to eq("dev@example.com")
      expect(user.name).to eq("Dev User")
      expect(user.reseller_uuid).to eq("res-1")
      expect(user.roles).to eq(%w[reseller_admin])
    end

    it "defaults roles to empty array" do
      expect(described_class.new.roles).to eq([])
    end
  end

  describe "role helpers" do
    it "#platform_admin?" do
      u = described_class.new(roles: %w[platform_admin])
      expect(u.platform_admin?).to be true
      expect(u.reseller_admin?).to be false
    end

    it "#reseller_admin?" do
      expect(user.reseller_admin?).to be true
      expect(user.platform_admin?).to be false
    end

    it "#customer_admin?" do
      u = described_class.new(roles: %w[customer_admin])
      expect(u.customer_admin?).to be true
    end

    it "#customer_viewer?" do
      u = described_class.new(roles: %w[customer_viewer])
      expect(u.customer_viewer?).to be true
      expect(u.customer_admin?).to be false
    end
  end

  describe "#customer_scoped?" do
    it "returns true for customer_admin with customer_uuid" do
      u = described_class.new(roles: %w[customer_admin], customer_uuid: "cust-1")
      expect(u.customer_scoped?).to be true
    end

    it "returns true for customer_viewer with customer_uuid" do
      u = described_class.new(roles: %w[customer_viewer], customer_uuid: "cust-1")
      expect(u.customer_scoped?).to be true
    end

    it "returns false for customer_admin without customer_uuid" do
      u = described_class.new(roles: %w[customer_admin])
      expect(u.customer_scoped?).to be false
    end

    it "returns false for platform_admin even with customer_uuid" do
      u = described_class.new(roles: %w[platform_admin], customer_uuid: "cust-1")
      expect(u.customer_scoped?).to be false
    end
  end

  describe "#to_param" do
    it "returns the uuid" do
      expect(user.to_param).to eq("user-1")
    end
  end

  describe "#persisted?" do
    it "returns true when uuid is present" do
      expect(user.persisted?).to be true
    end

    it "returns false when uuid is blank" do
      expect(described_class.new.persisted?).to be false
    end
  end

  describe ".from_api" do
    it "builds from a hash, ignoring unknown keys" do
      u = described_class.from_api(uuid: "x", email: "a@b.com", sub: "s", extra: "nope")
      expect(u.uuid).to eq("x")
      expect(u.email).to eq("a@b.com")
    end
  end
end
