# frozen_string_literal: true

require "rails_helper"

RSpec.describe CsInternalApiClient do
  let(:base_url) { "http://cs-internal-api.test" }
  let(:client) { described_class.new }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  before do
    ENV["CS_INTERNAL_API_URL"] = base_url
    Rails.cache.clear
  end

  # ---------------------------------------------------------------------------
  # Resellers
  # ---------------------------------------------------------------------------

  describe "#get_reseller" do
    it "fetches a reseller by uuid" do
      stub_request(:get, "#{base_url}/reseller/abc-123")
        .to_return(status: 200, body: '{"uuid":"abc-123","name":"Cloudsisters"}', headers: json_headers)

      response = client.get_reseller(uuid: "abc-123")
      expect(response.success?).to be true
      expect(response.data[:name]).to eq("Cloudsisters")
    end
  end

  describe "#list_resellers" do
    it "fetches all resellers" do
      stub_request(:get, "#{base_url}/reseller")
        .to_return(status: 200, body: '[{"uuid":"r1"}]', headers: json_headers)

      response = client.list_resellers
      expect(response.success?).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # Customers
  # ---------------------------------------------------------------------------

  describe "#list_customers" do
    it "fetches customers for a reseller" do
      stub_request(:get, "#{base_url}/customer")
        .with(query: { reseller_uuid: "r1" })
        .to_return(status: 200, body: '[{"uuid":"c1","name":"Acme"}]', headers: json_headers)

      response = client.list_customers(reseller_uuid: "r1")
      expect(response.success?).to be true
    end
  end

  describe "#create_customer" do
    it "creates a customer" do
      stub_request(:post, "#{base_url}/customer")
        .to_return(status: 201, body: '{"uuid":"c-new"}', headers: json_headers)

      response = client.create_customer(name: "New Corp")
      expect(response.success?).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # Environments
  # ---------------------------------------------------------------------------

  describe "#list_environments" do
    it "fetches environments for a project" do
      stub_request(:get, "#{base_url}/environment")
        .with(query: { project_uuid: "p1" })
        .to_return(status: 200, body: '[{"uuid":"e1"}]', headers: json_headers)

      response = client.list_environments(project_uuid: "p1")
      expect(response.success?).to be true
    end
  end

  describe "#delete_environment" do
    it "deletes an environment" do
      stub_request(:delete, "#{base_url}/environment/e1")
        .to_return(status: 204, body: "", headers: {})

      response = client.delete_environment(uuid: "e1")
      expect(response.success?).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # Users
  # ---------------------------------------------------------------------------

  describe "#get_user" do
    it "fetches a user by uuid" do
      stub_request(:get, "#{base_url}/user/u1")
        .to_return(status: 200, body: '{"uuid":"u1","email":"test@example.com"}', headers: json_headers)

      response = client.get_user(uuid: "u1")
      expect(response.data[:email]).to eq("test@example.com")
    end
  end

  describe "#find_user_by_email" do
    it "fetches a user by email (not cached)" do
      stub = stub_request(:get, "#{base_url}/user")
        .with(query: { email: "test@example.com" })
        .to_return(status: 200, body: '{"uuid":"u1"}', headers: json_headers)

      client.find_user_by_email(email: "test@example.com")
      client.find_user_by_email(email: "test@example.com")

      expect(stub).to have_been_requested.twice
    end
  end

  # ---------------------------------------------------------------------------
  # Caching
  # ---------------------------------------------------------------------------

  describe "caching behavior" do
    around do |example|
      original_store = Rails.cache
      Rails.cache = ActiveSupport::Cache::MemoryStore.new
      example.run
    ensure
      Rails.cache = original_store
    end

    it "caches GET responses" do
      stub = stub_request(:get, "#{base_url}/reseller/r1")
        .to_return(status: 200, body: '{"uuid":"r1"}', headers: json_headers)

      client.get_reseller(uuid: "r1")
      client.get_reseller(uuid: "r1")

      expect(stub).to have_been_requested.once
    end

    it "invalidates cache on write operations" do
      get_stub = stub_request(:get, "#{base_url}/customer/c1")
        .to_return(status: 200, body: '{"uuid":"c1"}', headers: json_headers)
      stub_request(:put, "#{base_url}/customer/c1")
        .to_return(status: 200, body: '{"uuid":"c1"}', headers: json_headers)

      # First GET populates cache
      client.get_customer(uuid: "c1")
      expect(get_stub).to have_been_requested.once

      # Write invalidates cache
      client.update_customer(uuid: "c1", attrs: { name: "Updated" })

      # Second GET should hit the API again (cache was invalidated)
      client.get_customer(uuid: "c1")
      expect(get_stub).to have_been_requested.twice
    end
  end
end
