# frozen_string_literal: true

puts "  → Seeding default business rules..."

BusinessRule.find_or_create_by!(name: "No public databases") do |r|
  r.description = "Database resources (RDS, DynamoDB, ElastiCache, OpenSearch) must never be placed in a public subnet. The platform auto-redirects to private subnet and issues a warning."
  r.severity = "block"
  r.rule_type = "network_isolation"
  r.scope_type = "platform"
  r.conditions = {
    "if_conditions" => [
      { "field" => "resource.type", "operator" => "IN", "value" => ["rds", "dynamodb", "elasticache", "opensearch"] }
    ],
    "then_conditions" => [
      { "field" => "resource.subnet_type", "operator" => "MUST_BE", "value" => "private" }
    ]
  }
  r.actions = { "action_list" => ["auto_move_to_private", "notify_user"] }
  r.enabled = true
  r.cloud_provider = "multi"
end

BusinessRule.find_or_create_by!(name: "Encryption at rest required") do |r|
  r.description = "All storage resources (S3, EBS, RDS, EFS) must have encryption enabled. Deployment blocked if disabled."
  r.severity = "block"
  r.rule_type = "encryption"
  r.scope_type = "platform"
  r.conditions = {
    "if_conditions" => [
      { "field" => "resource.type", "operator" => "IN", "value" => ["s3", "ebs", "rds", "efs"] }
    ],
    "then_conditions" => [
      { "field" => "resource.encryption", "operator" => "MUST_BE", "value" => true }
    ]
  }
  r.actions = { "action_list" => ["block_deploy", "show_validation_error"] }
  r.enabled = true
  r.cloud_provider = "multi"
end

BusinessRule.find_or_create_by!(name: "Production requires Multi-AZ") do |r|
  r.description = "Production stateful resources should be Multi-AZ. Warns on canvas, blocks during deploy review."
  r.severity = "warn"
  r.rule_type = "high_availability"
  r.scope_type = "platform"
  r.conditions = {
    "if_conditions" => [
      { "field" => "env.type", "operator" => "==", "value" => "production" },
      { "field" => "resource.stateful", "operator" => "==", "value" => true }
    ],
    "then_conditions" => [
      { "field" => "resource.multi_az", "operator" => "MUST_BE", "value" => true }
    ]
  }
  r.actions = { "action_list" => ["warn_on_canvas", "block_deploy_review"] }
  r.enabled = true
  r.cloud_provider = "multi"
end

BusinessRule.find_or_create_by!(name: "VPC CIDR range constraints") do |r|
  r.description = "VPCs must use pre-approved CIDR ranges. Cross-env peering must not overlap. Platform auto-assigns non-conflicting ranges."
  r.severity = "info"
  r.rule_type = "network_isolation"
  r.scope_type = "platform"
  r.conditions = {
    "if_conditions" => [
      { "field" => "resource.type", "operator" => "==", "value" => "vpc" }
    ],
    "then_conditions" => [
      { "field" => "resource.public_access", "operator" => "MUST_BE", "value" => false }
    ]
  }
  r.actions = { "action_list" => ["warn_on_canvas"] }
  r.enabled = true
  r.cloud_provider = "multi"
end

BusinessRule.find_or_create_by!(name: "Global services outside VPC") do |r|
  r.description = "SQS, SNS, S3, DynamoDB, and similar services cannot be placed in VPC subnets"
  r.severity = "block"
  r.rule_type = "network_isolation"
  r.scope_type = "platform"
  r.conditions = {
    "if_conditions" => [
      { "field" => "module.name", "operator" => "IN", "value" => ["sqs", "sns", "s3_bucket", "dynamodb"] }
    ],
    "then_conditions" => [
      { "field" => "resource.subnet_type", "operator" => "MUST_BE", "value" => "global" }
    ]
  }
  r.actions = { "action_list" => ["auto_move_to_global", "notify_user"] }
  r.enabled = true
  r.cloud_provider = "aws"
end

BusinessRule.find_or_create_by!(name: "Mandatory resource tagging") do |r|
  r.description = "All resources must include cost-center, team, and environment tags. Blocks deploy if missing."
  r.severity = "block"
  r.rule_type = "tagging"
  r.scope_type = "platform"
  r.conditions = {
    "if_conditions" => [
      { "field" => "resource.type", "operator" => "!=", "value" => "none" }
    ],
    "then_conditions" => [
      { "field" => "resource.tags", "operator" => "CONTAINS", "value" => "cost-center" }
    ]
  }
  r.actions = { "action_list" => ["block_deploy", "show_validation_error"] }
  r.enabled = true
  r.cloud_provider = "multi"
end

puts "    ✓ #{BusinessRule.count} business rules"
