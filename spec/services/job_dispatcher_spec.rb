# frozen_string_literal: true

require "rails_helper"

RSpec.describe JobDispatcher do
  let(:sqs_client) { instance_double(Aws::SQS::Client) }
  let(:env) { create(:local_environment) }
  let(:deployment) { create(:deployment, local_environment: env, total_layers: 1) }
  let(:layer) { create(:deployment_layer, deployment: deployment, index: 0, state_key: "aws/123/dev/layer_0.tfstate") }

  let(:ir_payload) do
    {
      environment: { cloud_provider: "aws", region: "eu-west-1", iac_engine: "opentofu" },
      credentials: { aws_account_id: "123456789012" },
      backend: { type: "s3", bucket: "f50-tfstate", key: layer.state_key, region: "eu-west-1", version: "000001" },
      modules: [],
      layer_context: { layer_index: 0, required_providers: ["aws"], remote_state_refs: [], state_key: layer.state_key },
      git_credentials: [],
      tags: { "managed_by" => "factorfifty" },
      callback_url: "http://localhost:3000/api/callbacks/deployments/#{deployment.id}"
    }
  end

  before do
    allow(Aws::SQS::Client).to receive(:new).and_return(sqs_client)
    allow(sqs_client).to receive(:send_message).and_return(double(message_id: "msg-1"))
  end

  describe "#dispatch_plan" do
    it "publishes a plan job to SQS and returns a job_id" do
      dispatcher = described_class.new
      job_id = dispatcher.dispatch_plan(deployment, layer, ir_payload)

      expect(job_id).to be_a(String)
      expect(sqs_client).to have_received(:send_message).with(
        hash_including(
          message_group_id: "123456789012",
          message_attributes: hash_including(
            "account_id" => { string_value: "123456789012", data_type: "String" },
            "execution_mode" => { string_value: "platform", data_type: "String" }
          )
        )
      )
    end

    it "includes the correct action in the message body" do
      dispatcher = described_class.new
      dispatcher.dispatch_plan(deployment, layer, ir_payload)

      expect(sqs_client).to have_received(:send_message) do |args|
        body = JSON.parse(args[:message_body])
        expect(body["action"]).to eq("plan")
      end
    end
  end

  describe "#dispatch_deploy" do
    it "publishes a deploy job to SQS" do
      dispatcher = described_class.new
      dispatcher.dispatch_deploy(deployment, layer, ir_payload)

      expect(sqs_client).to have_received(:send_message) do |args|
        body = JSON.parse(args[:message_body])
        expect(body["action"]).to eq("deploy")
      end
    end
  end

  describe "error handling" do
    it "raises DispatchError on SQS failure" do
      allow(sqs_client).to receive(:send_message)
        .and_raise(Aws::SQS::Errors::ServiceError.new(nil, "Queue not found"))

      dispatcher = described_class.new
      expect { dispatcher.dispatch_plan(deployment, layer, ir_payload) }
        .to raise_error(JobDispatcher::DispatchError, /Failed to publish job/)
    end
  end

  describe "execution_mode routing" do
    it "includes execution_mode=private when environment is private" do
      env.update!(execution_mode: "private")
      dispatcher = described_class.new
      dispatcher.dispatch_plan(deployment, layer, ir_payload)

      expect(sqs_client).to have_received(:send_message).with(
        hash_including(
          message_attributes: hash_including(
            "execution_mode" => { string_value: "private", data_type: "String" }
          )
        )
      )
    end

    it "uses the same queue URL regardless of execution mode" do
      env.update!(execution_mode: "private")
      dispatcher = described_class.new
      dispatcher.dispatch_plan(deployment, layer, ir_payload)

      expect(sqs_client).to have_received(:send_message).with(
        hash_including(
          queue_url: a_string_matching(/factorfiftyv2-pipeline-aws-eu-west-1\.fifo/)
        )
      )
    end
  end
end
