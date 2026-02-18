# frozen_string_literal: true

require "rails_helper"

RSpec.describe StaleHeartbeatDetectionJob, type: :job do
  let(:env) { create(:local_environment) }
  let(:deployment) { create(:deployment, local_environment: env, total_layers: 2) }
  let(:dynamodb_client) { instance_double(Aws::DynamoDB::Client) }

  before do
    allow(Aws::DynamoDB::Client).to receive(:new).and_return(dynamodb_client)
  end

  describe "#perform" do
    context "with no active layers" do
      it "completes without errors" do
        expect { described_class.new.perform }.not_to raise_error
      end
    end

    context "with a stale layer" do
      let!(:stale_layer) do
        create(:deployment_layer, deployment: deployment, index: 0,
               state_key: "k0", status: "executing",
               job_id: SecureRandom.uuid, started_at: 5.minutes.ago)
      end
      let!(:next_layer) do
        create(:deployment_layer, deployment: deployment, index: 1,
               state_key: "k1", status: "pending")
      end

      before do
        ENV["DYNAMODB_STATE_TABLE"] = "test-state-table"
        stale_time = (Time.current - 5.minutes).iso8601
        allow(dynamodb_client).to receive(:get_item).and_return(
          double(item: { "last_heartbeat" => stale_time })
        )
      end

      after { ENV.delete("DYNAMODB_STATE_TABLE") }

      it "marks the stale layer as failed" do
        described_class.new.perform
        expect(stale_layer.reload.status).to eq("failed")
        expect(stale_layer.error_details).to include("heartbeat stale")
      end

      it "skips subsequent layers" do
        described_class.new.perform
        expect(next_layer.reload.status).to eq("skipped")
      end

      it "marks the deployment as failed" do
        described_class.new.perform
        expect(deployment.reload.status).to eq("failed")
      end
    end
  end
end
