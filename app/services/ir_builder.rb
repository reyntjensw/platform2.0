# frozen_string_literal: true

class IRBuilder
  def initialize(environment)
    @env = environment
    @project = environment.local_project
    @customer = @project.local_customer
    @reseller = @customer.local_reseller
  end

  def build(deployment)
    {
      environment: environment_block,
      credentials: credentials_block,
      backend: backend_block(deployment),
      tags: TagMergerService.merge(@reseller, @customer, @project, @env),
      modules: modules_block,
      git_credentials: git_credentials_block,
      callback_url: callback_url(deployment)
    }
  end

  private

  def environment_block
    {
      uuid: @env.id,
      name: @env.name,
      env_type: @env.env_type,
      cloud_provider: @env.cloud_provider,
      region: @env.region
    }
  end

  def credentials_block
    {
      aws_account_id: @env.aws_account_id,
      aws_role_arn: @env.aws_role_arn,
      azure_subscription_id: @env.azure_subscription_id
    }.compact
  end

  def backend_block(deployment)
    bucket = ENV.fetch("S3_TFSTATE_BUCKET", "f50-tfstate")
    {
      type: "s3",
      bucket: bucket,
      key: "#{@env.cloud_provider}/#{@env.aws_account_id || @env.azure_subscription_id}/#{@env.env_type}.tfstate",
      region: @env.region,
      dynamodb_table: ENV.fetch("DYNAMODB_TFLOCK_TABLE", "f50-tflock")
    }
  end

  def modules_block
    @env.resources.includes(module_definition: [module_renderers: :field_mappings]).map do |resource|
      renderer = resource.module_definition.module_renderers.find_by(engine: @env.iac_engine)
      next unless renderer

      variables = build_variables(resource, renderer)

      {
        resource_id: resource.id,
        resource_name: resource.name,
        module_key: resource.module_definition.name,
        source: renderer.source_url,
        source_ref: renderer.source_ref,
        variables: variables
      }
    end.compact
  end

  def build_variables(resource, renderer)
    vars = {}
    renderer.field_mappings.each do |mapping|
      value = resolve_field_value(resource, mapping)
      vars[mapping.renderer_variable] = value unless value.nil?
    end
    vars
  end

  def resolve_field_value(resource, mapping)
    case mapping.mapping_type
    when "direct"
      resource.config&.dig(mapping.platform_field)
    when "platform_inject"
      resolve_platform_value(resource, mapping.platform_field)
    when "transform"
      apply_transform(resource.config&.dig(mapping.platform_field), mapping.transform)
    when "dependency_ref"
      resource.config&.dig(mapping.platform_field)
    end
  end

  def resolve_platform_value(resource, field_name)
    field = resource.module_definition.module_fields.find_by(name: field_name)
    return nil unless field&.platform_source

    case field.platform_source
    when "tags" then TagMergerService.merge(@reseller, @customer, @project, @env)
    when "env_name" then @env.name
    when "resource_name" then resource.name
    when "region" then @env.region
    end
  end

  def apply_transform(value, transform)
    return value unless transform && value

    case transform
    when "to_string" then value.to_s
    when "to_integer" then value.to_i
    when "wrap_list" then [value]
    else value
    end
  end

  def git_credentials_block
    GitCredential.where(active: true).map do |cred|
      { host: cred.host, token: cred.token }
    end
  end

  def callback_url(deployment)
    base = ENV.fetch("APP_URL", "http://localhost:3000")
    "#{base}/api/callbacks/deployments/#{deployment.id}"
  end
end
