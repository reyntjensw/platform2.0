# frozen_string_literal: true

require "rails_helper"

RSpec.describe BusinessRule, type: :model do
  subject(:rule) do
    described_class.new(
      name: "Test rule",
      severity: "block",
      scope_type: "platform",
      cloud_provider: "aws",
      conditions: { "categories" => ["database"], "restricted_zone" => "public" }
    )
  end

  describe "validations" do
    it { is_expected.to be_valid }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:severity) }
    it { is_expected.to validate_inclusion_of(:severity).in_array(%w[block warn info]) }
    it { is_expected.to validate_presence_of(:scope_type) }
    it { is_expected.to validate_inclusion_of(:scope_type).in_array(%w[platform customer]) }
    it { is_expected.to validate_presence_of(:cloud_provider) }
    it { is_expected.to validate_presence_of(:conditions) }

    it "validates uniqueness of name scoped to scope_type" do
      rule.save!
      duplicate = described_class.new(
        name: "Test rule",
        severity: "warn",
        scope_type: "platform",
        cloud_provider: "azure",
        conditions: { "restricted_zone" => "public" }
      )
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:name]).to include("has already been taken")
    end

    it "allows same name with different scope_type" do
      rule.save!
      other = described_class.new(
        name: "Test rule",
        severity: "warn",
        scope_type: "customer",
        cloud_provider: "aws",
        customer_id: SecureRandom.uuid,
        conditions: { "restricted_zone" => "private" }
      )
      expect(other).to be_valid
    end

    it "requires customer_id when scope_type is customer" do
      customer_rule = described_class.new(
        name: "Customer rule",
        severity: "warn",
        scope_type: "customer",
        cloud_provider: "aws",
        conditions: { "restricted_zone" => "public" }
      )
      expect(customer_rule).not_to be_valid
      expect(customer_rule.errors[:customer_id]).to include("can't be blank")
    end

    it "does not require customer_id when scope_type is platform" do
      expect(rule.customer_id).to be_nil
      expect(rule).to be_valid
    end
  end

  describe "scopes" do
    let!(:enabled_aws) do
      described_class.create!(
        name: "Enabled AWS", severity: "block", scope_type: "platform",
        cloud_provider: "aws", enabled: true,
        conditions: { "restricted_zone" => "public" }
      )
    end

    let!(:disabled_aws) do
      described_class.create!(
        name: "Disabled AWS", severity: "warn", scope_type: "platform",
        cloud_provider: "aws", enabled: false,
        conditions: { "restricted_zone" => "private" }
      )
    end

    let!(:enabled_multi) do
      described_class.create!(
        name: "Enabled Multi", severity: "info", scope_type: "platform",
        cloud_provider: "multi", enabled: true,
        conditions: { "restricted_zone" => "public" }
      )
    end

    let!(:customer_rule) do
      described_class.create!(
        name: "Customer specific", severity: "warn", scope_type: "customer",
        cloud_provider: "aws", enabled: true,
        customer_id: SecureRandom.uuid,
        conditions: { "restricted_zone" => "public" }
      )
    end

    describe ".enabled" do
      it "returns only enabled rules" do
        expect(described_class.enabled).to contain_exactly(enabled_aws, enabled_multi, customer_rule)
      end
    end

    describe ".for_cloud_provider" do
      it "returns rules matching the provider or multi" do
        expect(described_class.for_cloud_provider("aws")).to contain_exactly(enabled_aws, disabled_aws, enabled_multi, customer_rule)
      end
    end

    describe ".platform_rules" do
      it "returns only platform-scoped rules" do
        expect(described_class.platform_rules).to contain_exactly(enabled_aws, disabled_aws, enabled_multi)
      end
    end

    describe ".customer_rules" do
      it "returns only that customer's rules" do
        expect(described_class.customer_rules(customer_rule.customer_id)).to contain_exactly(customer_rule)
      end
    end
  end
end
