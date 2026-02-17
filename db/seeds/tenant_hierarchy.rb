# frozen_string_literal: true

puts "Seeding tenant hierarchy..."

reseller = LocalReseller.find_or_create_by!(slug: "cloudsisters") do |r|
  r.name = "Cloudsisters"
  r.config = { default_tags: { managed_by: "factorfifty" } }
  r.keycloak_group_path = "/resellers/cloudsisters"
end

customer = LocalCustomer.find_or_create_by!(slug: "immovlan-bv", local_reseller: reseller) do |c|
  c.name = "Immovlan BV"
  c.config = { default_tags: { customer: "immovlan-bv" } }
  c.keycloak_group_path = "/resellers/cloudsisters/customers/immovlan-bv"
end

project = LocalProject.find_or_create_by!(slug: "immovlan-aws", local_customer: customer) do |p|
  p.name = "Immovlan AWS"
  p.cloud_provider = "aws"
  p.default_region = "eu-west-1"
end

%w[dev acc prd].each do |env_type|
  account_ids = { "dev" => "111111111111", "acc" => "222222222222", "prd" => "333333333333" }

  LocalEnvironment.find_or_create_by!(local_project: project, env_type: env_type) do |e|
    e.name = env_type == "prd" ? "production" : (env_type == "acc" ? "acceptance" : "development")
    e.cloud_provider = "aws"
    e.iac_engine = "opentofu"
    e.region = "eu-west-1"
    e.aws_account_id = account_ids[env_type]
    e.aws_role_arn = "arn:aws:iam::#{account_ids[env_type]}:role/f50-deploy"
    e.config = { default_tags: { environment: e.name, env_type: env_type } }
  end
end

puts "  Created: #{reseller.name} > #{customer.name} > #{project.name} > #{LocalEnvironment.count} environments"
