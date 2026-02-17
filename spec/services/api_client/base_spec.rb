# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApiClient::Base do
  let(:base_url) { "http://test-api.example.com" }

  # Concrete subclass to test the private methods
  let(:client_class) do
    Class.new(described_class) do
      def initialize(base_url)
        @conn = self.class.connection(base_url)
      end

      # Expose private methods for testing
      public :get, :post, :put, :delete

      private

      attr_reader :conn
    end
  end

  let(:client) { client_class.new(base_url) }

  describe ".connection" do
    it "creates a Faraday connection" do
      conn = described_class.connection(base_url)
      expect(conn).to be_a(Faraday::Connection)
    end
  end

  describe "#get" do
    it "makes a GET request and returns a Response" do
      stub_request(:get, "#{base_url}/items")
        .to_return(status: 200, body: '{"items":[]}', headers: { "Content-Type" => "application/json" })

      response = client.get("/items")
      expect(response).to be_a(ApiClient::Response)
      expect(response.success?).to be true
    end
  end

  describe "#post" do
    it "makes a POST request and returns a Response" do
      stub_request(:post, "#{base_url}/items")
        .to_return(status: 201, body: '{"id":"1"}', headers: { "Content-Type" => "application/json" })

      response = client.post("/items", { name: "test" })
      expect(response.success?).to be true
      expect(response.status).to eq(201)
    end
  end

  describe "#put" do
    it "makes a PUT request and returns a Response" do
      stub_request(:put, "#{base_url}/items/1")
        .to_return(status: 200, body: '{"id":"1"}', headers: { "Content-Type" => "application/json" })

      response = client.put("/items/1", { name: "updated" })
      expect(response.success?).to be true
    end
  end

  describe "#delete" do
    it "makes a DELETE request and returns a Response" do
      stub_request(:delete, "#{base_url}/items/1")
        .to_return(status: 204, body: "", headers: {})

      response = client.delete("/items/1")
      expect(response.success?).to be true
    end
  end

  describe "error handling" do
    it "handles Faraday::TimeoutError" do
      stub_request(:get, "#{base_url}/slow")
        .to_raise(Faraday::TimeoutError.new("execution expired"))

      response = client.get("/slow")
      expect(response.success?).to be false
      expect(response.status).to eq(0)
      expect(response.error).to include("timed out")
    end

    it "handles Faraday::ConnectionFailed" do
      stub_request(:get, "#{base_url}/down")
        .to_raise(Faraday::ConnectionFailed.new("Connection refused"))

      response = client.get("/down")
      expect(response.success?).to be false
      expect(response.status).to eq(0)
      expect(response.error).to include("Connection failed")
    end

    it "handles generic Faraday::Error" do
      stub_request(:get, "#{base_url}/error")
        .to_raise(Faraday::Error.new("something went wrong"))

      response = client.get("/error")
      expect(response.success?).to be false
      expect(response.status).to eq(0)
      expect(response.error).to include("Request error")
    end
  end
end
