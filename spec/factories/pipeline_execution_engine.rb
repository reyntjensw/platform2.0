# frozen_string_literal: true

FactoryBot.define do
  factory :local_reseller do
    name { "Test Reseller" }
    slug { "test-reseller" }
    config { {} }
  end

  factory :local_customer do
    association :local_reseller
    name { "Test Customer" }
    slug { "test-customer" }
  end

  factory :local_project do
    association :local_customer
    name { "Test Project" }
    slug { "test-project" }
    cloud_provider { "aws" }
  end

  factory :local_environment do
    association :local_project
    name { "dev" }
    env_type { "dev" }
    cloud_provider { "aws" }
    iac_engine { "opentofu" }
    region { "eu-west-1" }
    aws_account_id { "123456789012" }
  end

  factory :module_definition do
    sequence(:name) { |n| "module-#{n}" }
    sequence(:display_name) { |n| "Module #{n}" }
    cloud_provider { "aws" }
    category { "compute" }
    status { "live" }
    provider_dependencies { ["aws"] }
  end

  factory :module_renderer do
    association :module_definition
    engine { "opentofu" }
    source_type { "git" }
    source_url { "git::https://gitlab.com/example/module.git" }
    source_ref { "v1.0.0" }
  end

  factory :resource do
    association :local_environment
    association :module_definition
    sequence(:name) { |n| "resource-#{n}" }
    config { {} }
    zone { "private" }
  end

  factory :connection do
    association :from_resource, factory: :resource
    association :to_resource, factory: :resource
    connection_type { "dependency" }
  end

  factory :deployment do
    association :local_environment
    triggered_by_uuid { SecureRandom.uuid }
    status { "pending" }
    total_layers { 1 }
    current_layer { 0 }
  end

  factory :deployment_layer do
    association :deployment
    sequence(:index) { |n| n }
    resource_ids { [] }
    required_providers { ["aws"] }
    remote_state_refs { [] }
    state_key { "aws/123456789012/dev/layer_0.tfstate" }
    status { "pending" }
  end

  factory :git_credential do
    owner_type { "LocalReseller" }
    owner_id { SecureRandom.uuid }
    name { "GitLab Token" }
    host { "gitlab.com" }
    token { "glpat-test-token" }
    credential_type { "personal_access_token" }
    active { true }
  end
end
