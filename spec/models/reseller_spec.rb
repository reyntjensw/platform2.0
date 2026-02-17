# frozen_string_literal: true

require "rails_helper"

RSpec.describe Reseller do
  subject(:reseller) { described_class.new(uuid: "abc-123", name: "Cloudsisters") }

  it "includes ApiBacked" do
    expect(described_class.ancestors).to include(ApiBacked)
  end

  describe "attributes" do
    it "has expected attributes" do
      r = described_class.new(
        uuid: "abc-123",
        name: "Cloudsisters",
        inactive: true,
        vat_number: "BE123",
        invoicing_mail_address: "billing@example.com",
        keycloak_group_id: "kg-1"
      )
      expect(r.uuid).to eq("abc-123")
      expect(r.name).to eq("Cloudsisters")
      expect(r.inactive).to be true
      expect(r.vat_number).to eq("BE123")
      expect(r.invoicing_mail_address).to eq("billing@example.com")
      expect(r.keycloak_group_id).to eq("kg-1")
    end

    it "defaults inactive to false" do
      expect(described_class.new.inactive).to be false
    end
  end

  describe "#to_param" do
    it "returns the uuid" do
      expect(reseller.to_param).to eq("abc-123")
    end
  end

  describe "#persisted?" do
    it "returns true when uuid is present" do
      expect(reseller.persisted?).to be true
    end

    it "returns false when uuid is blank" do
      expect(described_class.new.persisted?).to be false
    end
  end

  describe ".from_api" do
    it "builds from a hash, ignoring unknown keys" do
      r = described_class.from_api(uuid: "x", name: "Test", unknown_key: "ignored")
      expect(r.uuid).to eq("x")
      expect(r.name).to eq("Test")
    end
  end
end
