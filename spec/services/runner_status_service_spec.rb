# frozen_string_literal: true

require "rails_helper"

RSpec.describe RunnerStatusService do
  let(:dynamodb_client) { instance_double(Aws::DynamoDB::Client) }
  let(:s3_client) { instance_double(Aws::S3::Client) }

  before do
    allow(Aws::DynamoDB::Client).to receive(:new).and_return(dynamodb_client)
    allow(Aws::S3::Client).to receive(:new).and_return(s3_client)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("DYNAMODB_STATE_TABLE").and_return("test-state-table")
    allow(ENV).to receive(:[]).with("S3_ARTIFACTS_BUCKET").and_return("test-artifacts")
  end

  describe "#list_runners" do
    let(:runner_item) do
      {
        "PK" => "RUNNER#123456",
        "SK" => "RUNNER#runner-1",
        "runner_id" => "runner-1",
        "account_id" => "123456",
        "runner_mode" => "ec2",
        "execution_mode" => "private",
        "version" => "1.3.0",
        "status" => "active",
        "last_heartbeat" => "2026-02-17T12:00:00Z",
        "registered_at" => "2026-02-15T10:00:00Z"
      }
    end

    it "queries runners for a specific account" do
      service = described_class.new(account_id: "123456")
      allow(dynamodb_client).to receive(:query).and_return(
        double(items: [runner_item])
      )

      runners = service.list_runners

      expect(runners.length).to eq(1)
      expect(runners.first[:runner_id]).to eq("runner-1")
      expect(runners.first[:account_id]).to eq("123456")
      expect(runners.first[:version]).to eq("1.3.0")
      expect(runners.first[:status]).to eq("active")
    end

    it "scans all runners when no account_id given" do
      service = described_class.new
      allow(dynamodb_client).to receive(:scan).and_return(
        double(items: [runner_item])
      )

      runners = service.list_runners

      expect(runners.length).to eq(1)
      expect(dynamodb_client).to have_received(:scan)
    end

    it "returns empty array when table not configured" do
      allow(ENV).to receive(:[]).with("DYNAMODB_STATE_TABLE").and_return(nil)
      service = described_class.new

      expect(service.list_runners).to eq([])
    end

    it "returns empty array on DynamoDB error" do
      service = described_class.new
      allow(dynamodb_client).to receive(:scan)
        .and_raise(Aws::DynamoDB::Errors::ServiceError.new(nil, "Connection refused"))

      expect(service.list_runners).to eq([])
    end
  end

  describe "#fetch_manifest" do
    let(:manifest_json) do
      {
        "current_version" => "1.4.0",
        "min_compatible_version" => "1.2.0"
      }.to_json
    end

    it "fetches and parses the manifest from S3" do
      service = described_class.new
      allow(s3_client).to receive(:get_object).and_return(
        double(body: StringIO.new(manifest_json))
      )

      manifest = service.fetch_manifest

      expect(manifest["current_version"]).to eq("1.4.0")
      expect(manifest["min_compatible_version"]).to eq("1.2.0")
    end

    it "returns nil when bucket not configured" do
      allow(ENV).to receive(:[]).with("S3_ARTIFACTS_BUCKET").and_return(nil)
      service = described_class.new

      expect(service.fetch_manifest).to be_nil
    end

    it "returns nil on S3 error" do
      service = described_class.new
      allow(s3_client).to receive(:get_object)
        .and_raise(Aws::S3::Errors::NoSuchKey.new(nil, "Not found"))

      expect(service.fetch_manifest).to be_nil
    end
  end
end
