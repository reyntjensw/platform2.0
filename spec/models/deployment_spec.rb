# frozen_string_literal: true

require "rails_helper"

RSpec.describe Deployment, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_presence_of(:triggered_by_uuid) }
    it { is_expected.to validate_inclusion_of(:status).in_array(Deployment::STATUSES) }
    it { is_expected.to validate_inclusion_of(:approval_status).in_array(Deployment::APPROVAL_STATUSES).allow_nil }
  end

  describe "associations" do
    it { is_expected.to belong_to(:local_environment) }
    it { is_expected.to have_many(:deployment_layers).dependent(:destroy) }
  end

  describe "status helpers" do
    let(:env) { create(:local_environment) }

    it "reports planning?" do
      d = create(:deployment, local_environment: env, status: "planning")
      expect(d).to be_planning
    end

    it "reports planned?" do
      d = create(:deployment, local_environment: env, status: "planned")
      expect(d).to be_planned
    end

    it "reports approved?" do
      d = create(:deployment, local_environment: env, approval_status: "approved")
      expect(d).to be_approved
    end

    it "reports in_progress? for active statuses" do
      %w[pending dispatched planning applying].each do |s|
        d = build(:deployment, local_environment: env, status: s)
        expect(d).to be_in_progress
      end
    end

    it "reports not in_progress? for terminal statuses" do
      %w[completed failed rejected].each do |s|
        d = build(:deployment, local_environment: env, status: s)
        expect(d).not_to be_in_progress
      end
    end
  end
end
