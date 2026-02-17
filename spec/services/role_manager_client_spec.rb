# frozen_string_literal: true

require "rails_helper"

RSpec.describe RoleManagerClient do
  let(:base_url) { "http://role-manager.test" }
  let(:client) { described_class.new }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  before do
    ENV["ROLE_MANAGER_URL"] = base_url
  end

  describe "#prepare_account" do
    it "prepares an account" do
      stub_request(:post, "#{base_url}/accounts/prepare")
        .to_return(status: 200, body: '{"external_id":"ext-123","management_account_id":"mgmt-1"}', headers: json_headers)

      response = client.prepare_account
      expect(response.success?).to be true
      expect(response.data[:external_id]).to eq("ext-123")
    end
  end

  describe "#validate_account" do
    it "validates an account" do
      stub_request(:post, "#{base_url}/accounts/validate")
        .to_return(status: 200, body: '{"valid":true}', headers: json_headers)

      response = client.validate_account(account_id: "111111111111", external_id: "ext-123", role_name: "f50-deploy")
      expect(response.success?).to be true
    end
  end

  describe "#register_account" do
    it "registers an account" do
      stub_request(:post, "#{base_url}/accounts/register")
        .to_return(status: 201, body: '{"job_id":"job-1"}', headers: json_headers)

      response = client.register_account(
        customer_uuid: "c1", project_uuid: "p1", aws_account_id: "111111111111",
        external_id: "ext-123", role_name: "f50-deploy", role_types: ["readonly", "finops"], sla: "production"
      )
      expect(response.success?).to be true
      expect(response.data[:job_id]).to eq("job-1")
    end
  end

  describe "#revalidate_account" do
    it "revalidates an account" do
      stub_request(:post, "#{base_url}/accounts/revalidate")
        .to_return(status: 200, body: '{"valid":true}', headers: json_headers)

      response = client.revalidate_account(customer_uuid: "c1", project_uuid: "p1", aws_account_id: "111111111111")
      expect(response.success?).to be true
    end
  end

  describe "#get_account_roles" do
    it "fetches account roles" do
      stub_request(:get, "#{base_url}/accounts/roles")
        .with(query: { customer_uuid: "c1", project_uuid: "p1", aws_account_id: "111111111111" })
        .to_return(status: 200, body: '[{"role_type":"readonly","arn":"arn:aws:iam::111111111111:role/f50-readonly"}]', headers: json_headers)

      response = client.get_account_roles(customer_uuid: "c1", project_uuid: "p1", aws_account_id: "111111111111")
      expect(response.success?).to be true
    end
  end

  describe "#create_deployment" do
    it "creates a deployment" do
      stub_request(:post, "#{base_url}/deployments")
        .to_return(status: 201, body: '{"job_id":"deploy-1"}', headers: json_headers)

      response = client.create_deployment(targets: [{ account_id: "111111111111" }])
      expect(response.success?).to be true
      expect(response.data[:job_id]).to eq("deploy-1")
    end
  end

  describe "#get_deployment_status" do
    it "fetches deployment status" do
      stub_request(:get, "#{base_url}/deployments/deploy-1")
        .to_return(status: 200, body: '{"status":"completed","progress":100}', headers: json_headers)

      response = client.get_deployment_status(job_id: "deploy-1")
      expect(response.success?).to be true
      expect(response.data[:status]).to eq("completed")
    end
  end
end
