# frozen_string_literal: true

require "rails_helper"

RSpec.describe Customer do
  subject(:customer) { described_class.new(uuid: "cust-1", reseller_uuid: "res-1", name: "Acme Corp") }

  it "includes ApiBacked" do
    expect(described_class.ancestors).to include(ApiBacked)
  end

  describe "attributes" do
    it "has expected attributes" do
      c = described_class.new(
        uuid: "cust-1",
        reseller_uuid: "res-1",
        name: "Acme Corp",
        inactive: true,
        vat_number: "BE456",
        invoicing_mail_address: "inv@acme.com",
        keycloak_group_id: "kg-2"
      )
      expect(c.uuid).to eq("cust-1")
      expect(c.reseller_uuid).to eq("res-1")
      expect(c.name).to eq("Acme Corp")
      expect(c.inactive).to be true
      expect(c.vat_number).to eq("BE456")
    end

    it "defaults inactive to false" do
      expect(described_class.new.inactive).to be false
    end
  end

  describe "#to_param" do
    it "returns the uuid" do
      expect(customer.to_param).to eq("cust-1")
    end
  end

  describe "#persisted?" do
    it "returns true when uuid is present" do
      expect(customer.persisted?).to be true
    end

    it "returns false when uuid is blank" do
      expect(described_class.new.persisted?).to be false
    end
  end

  describe ".from_api" do
    it "builds from a hash, ignoring unknown keys" do
      c = described_class.from_api(uuid: "x", name: "Test", reseller_uuid: "r", extra: "nope")
      expect(c.uuid).to eq("x")
      expect(c.reseller_uuid).to eq("r")
    end
  end
end
