# frozen_string_literal: true

puts "Seeding canvas resources..."

dev_env = LocalEnvironment.find_by!(env_type: "dev")

# Helper to create a resource
def seed_resource(env, module_name, name, zone: "private", position_x: 0, position_y: 0, config_overrides: {})
  mod = ModuleDefinition.find_by!(name: module_name, cloud_provider: env.cloud_provider)
  r = Resource.find_or_initialize_by(local_environment: env, name: name)
  r.module_definition = mod
  r.zone = zone
  r.position_x = position_x
  r.position_y = position_y
  r.save!
  r
end

# ═══════════════════════════════════════════════════
# Three-zone layout:
#   Public Subnet  (x: 50–210)   — VPC-bound public resources
#   Private Subnet (x: 370–560)  — VPC-bound private resources
#   Global / Regional (x: 800+)  — Services outside VPC
# ═══════════════════════════════════════════════════

# ── Public Subnet resources ──
vpc       = seed_resource(dev_env, "vpc",        "shared-vpc",         zone: "public",  position_x: 50,  position_y: 100)
alb       = seed_resource(dev_env, "alb",        "app-alb",            zone: "public",  position_x: 50,  position_y: 170)

# ── Private Subnet resources ──
eks       = seed_resource(dev_env, "eks_cluster",      "platform-eks",    zone: "private", position_x: 370, position_y: 170)
ecs       = seed_resource(dev_env, "ecs_service",      "api-service",     zone: "private", position_x: 370, position_y: 240)
rds       = seed_resource(dev_env, "rds_postgresql",   "app-postgres",    zone: "private", position_x: 370, position_y: 310)
redis     = seed_resource(dev_env, "elasticache_redis","session-cache",   zone: "private", position_x: 560, position_y: 310)
opensearch = seed_resource(dev_env, "opensearch",      "log-analytics",   zone: "private", position_x: 560, position_y: 380)
efs       = seed_resource(dev_env, "efs",       "shared-storage",      zone: "private", position_x: 560, position_y: 170)

# ── Global / Regional Services ──
cloudfront = seed_resource(dev_env, "cloudfront", "cdn-distribution",  zone: "global",  position_x: 800, position_y: 100)
s3_media  = seed_resource(dev_env, "s3_bucket",  "media-bucket",       zone: "global",  position_x: 800, position_y: 170)
s3_logs   = seed_resource(dev_env, "s3_bucket",  "logs-bucket",        zone: "global",  position_x: 800, position_y: 240)
iam_deploy = seed_resource(dev_env, "iam_role",  "deploy-role",        zone: "global",  position_x: 800, position_y: 310)
iam_app   = seed_resource(dev_env, "iam_role",   "app-role",           zone: "global",  position_x: 800, position_y: 380)
route53   = seed_resource(dev_env, "route53",    "main-dns",           zone: "global",  position_x: 800, position_y: 450)
lambda_fn = seed_resource(dev_env, "lambda",     "event-processor",    zone: "global",  position_x: 800, position_y: 520)
dynamo    = seed_resource(dev_env, "dynamodb",   "events-table",       zone: "global",  position_x: 800, position_y: 590)
kms       = seed_resource(dev_env, "kms_key",    "data-encryption-key",zone: "global",  position_x: 800, position_y: 660)

# ── Connections ──
def seed_connection(from, to, type = "dependency")
  Connection.find_or_create_by!(from_resource: from, to_resource: to) do |c|
    c.connection_type = type
  end
end

# Compute → Networking
seed_connection(eks, vpc)
seed_connection(ecs, vpc)
seed_connection(alb, vpc)
seed_connection(lambda_fn, vpc)

# Compute → Database
seed_connection(eks, rds)
seed_connection(eks, redis)
seed_connection(ecs, rds)
seed_connection(lambda_fn, dynamo)

# Compute → Storage
seed_connection(lambda_fn, s3_logs)
seed_connection(ecs, s3_media)

# Compute → Security
seed_connection(eks, iam_app)
seed_connection(lambda_fn, iam_app)
seed_connection(ecs, iam_app)

# Database → Security
seed_connection(rds, kms)
seed_connection(dynamo, kms)

# Networking
seed_connection(cloudfront, s3_media)
seed_connection(cloudfront, alb)
seed_connection(route53, cloudfront, "reference")
seed_connection(route53, alb, "reference")

# Storage → Security
seed_connection(s3_media, kms)
seed_connection(s3_logs, kms)

puts "  ✓ Seeded #{Resource.count} resources and #{Connection.count} connections for #{dev_env.name}"
