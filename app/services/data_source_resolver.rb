# frozen_string_literal: true

class DataSourceResolver
  # Resolves dynamic options for a module field based on its data_source
  # and the environment context (region, cloud provider, etc.).
  #
  # Usage:
  #   options = DataSourceResolver.resolve("aws_availability_zones", environment: env)
  #   # => [{ value: "eu-west-1a", label: "eu-west-1a" }, ...]

  REGISTRY = {}.freeze

  def self.resolve(data_source, environment:, resource: nil)
    resolver = registry[data_source]
    return [] unless resolver

    resolver.call(environment: environment, resource: resource)
  end

  def self.resolvable?(data_source)
    registry.key?(data_source)
  end

  def self.registry
    @registry ||= build_registry
  end

  def self.build_registry
    {
      "aws_availability_zones" => method(:resolve_aws_azs),
      "aws_az_count"           => method(:resolve_aws_az_count),
      "aws_instance_types"     => method(:resolve_aws_instance_types),
      "aws_regions"            => method(:resolve_aws_regions),
      "azure_regions"          => method(:resolve_azure_regions),
      "azure_availability_zones" => method(:resolve_azure_azs)
    }
  end

  # ── AWS Availability Zones ──────────────────────────────────────────
  # Returns the actual AZ names for the environment's region.
  # Static lookup — no API call needed. Covers the common regions.
  def self.resolve_aws_azs(environment:, resource: nil)
    region = environment.region || "eu-west-1"
    count = AWS_AZ_COUNTS[region] || 3
    (("a".."z").first(count)).map do |suffix|
      az = "#{region}#{suffix}"
      { value: az, label: az }
    end
  end

  # Returns count options (1, 2, 3) capped by the region's actual AZ count.
  # Useful for fields like "number of AZs" where the user picks a count
  # and the platform resolves the actual AZ names at deploy time.
  def self.resolve_aws_az_count(environment:, resource: nil)
    region = environment.region || "eu-west-1"
    max = AWS_AZ_COUNTS[region] || 3
    (1..max).map { |n| { value: n.to_s, label: "#{n} AZ#{"s" if n > 1}" } }
  end

  def self.resolve_aws_instance_types(environment:, resource: nil)
    # Common instance types — extend as needed or fetch from AWS API
    %w[t3.micro t3.small t3.medium t3.large m5.large m5.xlarge m5.2xlarge
       r5.large r5.xlarge c5.large c5.xlarge].map do |t|
      { value: t, label: t }
    end
  end

  def self.resolve_aws_regions(environment:, resource: nil)
    AWS_AZ_COUNTS.keys.sort.map { |r| { value: r, label: r } }
  end

  def self.resolve_azure_regions(environment:, resource: nil)
    %w[westeurope northeurope uksouth eastus eastus2 westus2 centralus
       southeastasia japaneast australiaeast].map do |r|
      { value: r, label: r }
    end
  end

  def self.resolve_azure_azs(environment:, resource: nil)
    region = environment.region || "westeurope"
    count = AZURE_AZ_COUNTS[region] || 3
    (1..count).map { |n| { value: n.to_s, label: "Zone #{n}" } }
  end

  # ── Static AZ count maps ───────────────────────────────────────────
  AWS_AZ_COUNTS = {
    "us-east-1" => 6, "us-east-2" => 3, "us-west-1" => 2, "us-west-2" => 4,
    "eu-west-1" => 3, "eu-west-2" => 3, "eu-west-3" => 3, "eu-central-1" => 3,
    "eu-north-1" => 3, "eu-south-1" => 3,
    "ap-southeast-1" => 3, "ap-southeast-2" => 3, "ap-northeast-1" => 3,
    "ap-northeast-2" => 4, "ap-south-1" => 3,
    "sa-east-1" => 3, "ca-central-1" => 3, "me-south-1" => 3,
    "af-south-1" => 3
  }.freeze

  AZURE_AZ_COUNTS = {
    "westeurope" => 3, "northeurope" => 3, "uksouth" => 3,
    "eastus" => 3, "eastus2" => 3, "westus2" => 3, "centralus" => 3,
    "southeastasia" => 3, "japaneast" => 3, "australiaeast" => 3
  }.freeze

  private_class_method :resolve_aws_azs, :resolve_aws_az_count,
                       :resolve_aws_instance_types, :resolve_aws_regions,
                       :resolve_azure_regions, :resolve_azure_azs
end
