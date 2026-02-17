# frozen_string_literal: true

require "rails_helper"

RSpec.describe PlatformApiClient do
  let(:base_url) { "http://platform-api.test" }
  let(:client) { described_class.new }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  before do
    ENV["PLATFORM_API_URL"] = base_url
  end

  # ---------------------------------------------------------------------------
  # Azure Credentials
  # ---------------------------------------------------------------------------

  describe "#test_azure" do
    it "posts credential test" do
      stub_request(:post, "#{base_url}/azure/credentials/test")
        .to_return(status: 200, body: '{"valid":true}', headers: json_headers)

      response = client.test_azure(tenant_id: "t1", client_id: "c1", client_secret: "s1")
      expect(response.success?).to be true
      expect(response.data[:valid]).to be true
    end
  end

  describe "#save_azure" do
    it "saves azure credentials" do
      stub_request(:post, "#{base_url}/azure/credentials/save")
        .to_return(status: 201, body: '{"credential_id":"cred-1"}', headers: json_headers)

      response = client.save_azure(customer_uuid: "c1", tenant_id: "t1", client_id: "ci1", client_secret: "cs1")
      expect(response.success?).to be true
    end
  end

  describe "#list_azure" do
    it "lists azure credentials" do
      stub_request(:post, "#{base_url}/azure/credentials/list")
        .to_return(status: 200, body: '[{"credential_id":"cred-1"}]', headers: json_headers)

      response = client.list_azure(customer_uuid: "c1")
      expect(response.success?).to be true
    end
  end

  describe "#expiring_azure" do
    it "lists expiring credentials" do
      stub_request(:post, "#{base_url}/azure/credentials/expiring")
        .to_return(status: 200, body: '[]', headers: json_headers)

      response = client.expiring_azure(customer_uuid: "c1")
      expect(response.success?).to be true
    end
  end

  describe "#link_subscription" do
    it "links a subscription" do
      stub_request(:post, "#{base_url}/azure/subscription/link")
        .to_return(status: 200, body: '{"linked":true}', headers: json_headers)

      response = client.link_subscription(customer_uuid: "c1", credential_id: "cred-1", subscription_id: "sub-1")
      expect(response.success?).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # Environment Info
  # ---------------------------------------------------------------------------

  describe "#list_env_info" do
    it "lists environment info" do
      stub_request(:get, "#{base_url}/environment_info")
        .to_return(status: 200, body: '[]', headers: json_headers)

      response = client.list_env_info
      expect(response.success?).to be true
    end
  end

  describe "#create_env_info" do
    it "creates environment info" do
      stub_request(:post, "#{base_url}/environment_info")
        .to_return(status: 201, body: '{"created":true}', headers: json_headers)

      response = client.create_env_info(customer_uuid: "c1", project_uuid: "p1")
      expect(response.success?).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # Onboarding
  # ---------------------------------------------------------------------------

  describe "#aws_onboard" do
    it "onboards an AWS account" do
      stub_request(:post, "#{base_url}/public/aws/onboarding/c1")
        .to_return(status: 200, body: '{"status":"ok"}', headers: json_headers)

      response = client.aws_onboard(customer_uuid: "c1", account_id: "111111111111")
      expect(response.success?).to be true
    end
  end

  describe "#verify_onboard" do
    it "verifies onboarding" do
      stub_request(:get, "#{base_url}/public/aws/onboarding/verify/c1/111111111111")
        .to_return(status: 200, body: '{"verified":true}', headers: json_headers)

      response = client.verify_onboard(customer_uuid: "c1", account_id: "111111111111")
      expect(response.success?).to be true
    end
  end

  # ---------------------------------------------------------------------------
  # Lookups
  # ---------------------------------------------------------------------------

  describe "#aws_regions" do
    it "fetches AWS regions" do
      stub_request(:get, "#{base_url}/public/aws/regions")
        .to_return(status: 200, body: '["eu-west-1","us-east-1"]', headers: json_headers)

      response = client.aws_regions
      expect(response.success?).to be true
    end
  end

  describe "#ec2_types" do
    it "fetches EC2 instance types" do
      stub_request(:get, "#{base_url}/public/aws/ec2/types")
        .to_return(status: 200, body: '["t3.micro"]', headers: json_headers)

      response = client.ec2_types
      expect(response.success?).to be true
    end
  end

  describe "#azure_regions" do
    it "fetches Azure regions" do
      stub_request(:get, "#{base_url}/public/azure/regions")
        .with(query: { subscription_id: "sub-1" })
        .to_return(status: 200, body: '["westeurope"]', headers: json_headers)

      response = client.azure_regions(subscription_id: "sub-1")
      expect(response.success?).to be true
    end
  end
end
