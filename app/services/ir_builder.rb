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

  # Builds IR for a specific deployment layer.
  #
  # @param deployment [Deployment]
  # @param layer [DeploymentLayer] with resource_ids, required_providers, remote_state_refs, state_key
  # @return [Hash] layer-specific IR payload
  def build_for_layer(deployment, layer)
    {
      environment: environment_block.merge(iac_engine: @env.iac_engine),
      credentials: credentials_block,
      backend: layer_backend_block(layer),
      tags: TagMergerService.merge(@reseller, @customer, @project, @env),
      modules: layer_modules_block(layer),
      layer_context: layer_context_block(layer),
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
    creds = {
      aws_account_id: @env.aws_account_id,
      azure_subscription_id: @env.azure_subscription_id,
      gcp_project_id: @env.gcp_project_id
    }.compact

    # For AWS: fetch role_arn and external_id from the platform's
    # environment_info record (via backend API, with DynamoDB GSI fallback).
    if @env.aws? && @env.aws_account_id.present?
      platform_creds = EnvironmentCredentialsService.fetch_aws(
        customer_uuid: @customer.slug,
        project_uuid: @project.slug,
        aws_account_id: @env.aws_account_id
      )
      creds[:aws_role_arn] = platform_creds[:role_arn]
      creds[:external_id] = platform_creds[:external_id]
    end

    creds
  end

  def backend_block(deployment)
    bucket = ENV.fetch("S3_TFSTATE_BUCKET", "f50-tfstate")
    account_id = @env.aws_account_id || @env.azure_subscription_id || @env.gcp_project_id
    {
      type: "s3",
      bucket: bucket,
      key: "#{@env.cloud_provider}/#{account_id}/#{@env.env_type}.tfstate",
      region: @env.region,
      dynamodb_table: ENV.fetch("DYNAMODB_TFLOCK_TABLE", "f50-tflock")
    }
  end

  def layer_backend_block(layer)
    bucket = ENV.fetch("S3_TFSTATE_BUCKET", "f50-tfstate")
    deployment = layer.deployment
    version = deployment.version.to_s.rjust(6, "0")
    {
      type: "s3",
      bucket: bucket,
      key: layer.state_key,
      region: @env.region,
      dynamodb_table: ENV.fetch("DYNAMODB_TFLOCK_TABLE", "f50-tflock"),
      version: version
    }
  end

  def layer_modules_block(layer)
    resource_ids = layer.resource_ids || []
    resources = @env.resources
                    .where(id: resource_ids)
                    .includes(module_definition: [module_renderers: :field_mappings])

    resources.map do |resource|
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

  def layer_context_block(layer)
    {
      layer_index: layer.index,
      required_providers: layer.required_providers || [],
      remote_state_refs: layer.remote_state_refs || [],
      state_key: layer.state_key
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
