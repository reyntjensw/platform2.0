# frozen_string_literal: true

require "rails_helper"
require "ostruct"

RSpec.describe AutoPlacementService do
  # Helper to create a minimal module definition
  def create_module(name:, cloud_provider: "aws", category: "compute", allowed_zones: %w[public private])
    ModuleDefinition.create!(
      name: name,
      display_name: name.titleize,
      status: "live",
      cloud_provider: cloud_provider,
      category: category,
      ownership: "platform",
      visibility: "global",
      allowed_zones: allowed_zones
    )
  end

  def create_rule(name:, severity: "block", cloud_provider: "aws", scope_type: "platform", conditions:, customer_id: nil, enabled: true)
    BusinessRule.create!(
      name: name,
      severity: severity,
      scope_type: scope_type,
      cloud_provider: cloud_provider,
      conditions: conditions,
      enabled: enabled,
      customer_id: customer_id
    )
  end

  describe ".determine_zone" do
    context "when module has a single allowed zone" do
      it "returns that zone" do
        mod = create_module(name: "rds_pg", category: "database", allowed_zones: %w[private])
        expect(described_class.determine_zone(mod)).to eq("private")
      end

      it "returns global for a global-only module" do
        mod = create_module(name: "s3_test", category: "storage", allowed_zones: %w[global])
        expect(described_class.determine_zone(mod)).to eq("global")
      end
    end

    context "when module has multiple allowed zones and no rules" do
      it "returns the first zone in the array" do
        mod = create_module(name: "ec2_test", allowed_zones: %w[public private])
        expect(described_class.determine_zone(mod)).to eq("public")
      end

      it "returns the first zone for a multi-zone module" do
        mod = create_module(name: "lambda_test", allowed_zones: %w[public private global])
        expect(described_class.determine_zone(mod)).to eq("public")
      end
    end

    context "when a blocking rule restricts a zone" do
      it "picks the first non-restricted zone" do
        mod = create_module(name: "db_instance", category: "database", allowed_zones: %w[public private])
        create_rule(
          name: "No public databases",
          conditions: { "categories" => ["database"], "restricted_zone" => "public" }
        )

        expect(described_class.determine_zone(mod)).to eq("private")
      end

      it "matches by module_names in conditions" do
        mod = create_module(name: "sqs_queue", category: "other", allowed_zones: %w[private global])
        create_rule(
          name: "SQS not in private",
          conditions: { "module_names" => ["sqs_queue"], "restricted_zone" => "private" }
        )

        expect(described_class.determine_zone(mod)).to eq("global")
      end
    end

    context "when all zones are restricted by blocking rules" do
      it "falls back to the first allowed zone" do
        mod = create_module(name: "weird_mod", category: "compute", allowed_zones: %w[public private])
        create_rule(
          name: "No public compute",
          conditions: { "categories" => ["compute"], "restricted_zone" => "public" }
        )
        create_rule(
          name: "No private compute",
          conditions: { "categories" => ["compute"], "restricted_zone" => "private" }
        )

        expect(described_class.determine_zone(mod)).to eq("public")
      end
    end

    context "when rules are disabled" do
      it "ignores disabled rules" do
        mod = create_module(name: "db_disabled", category: "database", allowed_zones: %w[public private])
        create_rule(
          name: "Disabled rule",
          conditions: { "categories" => ["database"], "restricted_zone" => "public" },
          enabled: false
        )

        expect(described_class.determine_zone(mod)).to eq("public")
      end
    end

    context "when rules are warn severity (not block)" do
      it "ignores warn rules for zone restriction" do
        mod = create_module(name: "db_warn", category: "database", allowed_zones: %w[public private])
        create_rule(
          name: "Warn public db",
          severity: "warn",
          conditions: { "categories" => ["database"], "restricted_zone" => "public" }
        )

        expect(described_class.determine_zone(mod)).to eq("public")
      end
    end

    context "with multi cloud_provider rules" do
      it "applies multi-provider rules to any cloud" do
        mod = create_module(name: "azure_db", cloud_provider: "azure", category: "database", allowed_zones: %w[public private])
        create_rule(
          name: "No public db multi",
          cloud_provider: "multi",
          conditions: { "categories" => ["database"], "restricted_zone" => "public" }
        )

        expect(described_class.determine_zone(mod)).to eq("private")
      end
    end

    context "with customer-scoped rules" do
      let(:customer_id) { SecureRandom.uuid }
      let(:customer) { OpenStruct.new(id: customer_id) }

      it "applies customer rules when customer is provided" do
        mod = create_module(name: "cust_mod", category: "compute", allowed_zones: %w[public private])
        create_rule(
          name: "Customer no public",
          scope_type: "customer",
          customer_id: customer_id,
          conditions: { "categories" => ["compute"], "restricted_zone" => "public" }
        )

        expect(described_class.determine_zone(mod, customer)).to eq("private")
      end

      it "does not apply customer rules when no customer is provided" do
        mod = create_module(name: "no_cust_mod", category: "compute", allowed_zones: %w[public private])
        create_rule(
          name: "Customer only rule",
          scope_type: "customer",
          customer_id: customer_id,
          conditions: { "categories" => ["compute"], "restricted_zone" => "public" }
        )

        expect(described_class.determine_zone(mod)).to eq("public")
      end
    end
  end
end
