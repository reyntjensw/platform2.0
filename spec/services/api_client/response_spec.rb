# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApiClient::Response do
  describe "#success?" do
    it "returns true for 200" do
      expect(described_class.new(status: 200).success?).to be true
    end

    it "returns true for 299" do
      expect(described_class.new(status: 299).success?).to be true
    end

    it "returns false for 404" do
      expect(described_class.new(status: 404).success?).to be false
    end

    it "returns false for 500" do
      expect(described_class.new(status: 500).success?).to be false
    end
  end

  describe "#data" do
    it "returns the body" do
      response = described_class.new(status: 200, body: { name: "test" })
      expect(response.data).to eq({ name: "test" })
    end
  end

  describe "#not_found?" do
    it "returns true for 404" do
      expect(described_class.new(status: 404).not_found?).to be true
    end

    it "returns false for 200" do
      expect(described_class.new(status: 200).not_found?).to be false
    end
  end

  describe "#server_error?" do
    it "returns true for 500" do
      expect(described_class.new(status: 500).server_error?).to be true
    end

    it "returns true for 503" do
      expect(described_class.new(status: 503).server_error?).to be true
    end

    it "returns false for 404" do
      expect(described_class.new(status: 404).server_error?).to be false
    end
  end

  describe "#to_s" do
    it "formats success" do
      expect(described_class.new(status: 200).to_s).to eq("OK(200)")
    end

    it "formats error with error message" do
      expect(described_class.new(status: 0, error: "timeout").to_s).to eq("Error(0: timeout)")
    end

    it "formats error with body when no error message" do
      expect(described_class.new(status: 500, body: "Internal Server Error").to_s).to eq("Error(500: Internal Server Error)")
    end
  end
end
