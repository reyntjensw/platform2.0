# frozen_string_literal: true

puts "Setting allowed_zones on module definitions..."

# Zone assignments per the design document.
# Modules not listed here keep the default ["public", "private"].
ZONE_ASSIGNMENTS = {
  # AWS modules
  ["aws_instance",      "aws"]   => %w[public private],
  ["vpc",               "aws"]   => %w[public private],
  ["alb",               "aws"]   => %w[public],
  ["rds_postgresql",    "aws"]   => %w[private],
  ["eks_cluster",       "aws"]   => %w[private],
  ["ecs_service",       "aws"]   => %w[private],
  ["s3_bucket",         "aws"]   => %w[global],
  ["sqs",               "aws"]   => %w[global],
  ["dynamodb",          "aws"]   => %w[global],
  ["lambda",            "aws"]   => %w[public private global],
  ["iam_role",          "aws"]   => %w[global],
  ["kms_key",           "aws"]   => %w[global],
  ["cloudfront",        "aws"]   => %w[global],
  ["route53",           "aws"]   => %w[global],
  ["efs",               "aws"]   => %w[private],
  ["elasticache_redis", "aws"]   => %w[private],
  ["opensearch",        "aws"]   => %w[private],

  # Azure modules
  ["azure_vm",          "azure"] => %w[public private],
  ["azure_sql",         "azure"] => %w[private]
}.freeze

updated = 0
ZONE_ASSIGNMENTS.each do |(name, cloud_provider), zones|
  mod = ModuleDefinition.find_by(name: name, cloud_provider: cloud_provider)
  next unless mod

  mod.update!(allowed_zones: zones)
  updated += 1
end

puts "  ✓ Updated allowed_zones for #{updated} module definitions"
