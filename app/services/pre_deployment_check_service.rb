# frozen_string_literal: true

class PreDeploymentCheckService
  CheckResult = Struct.new(:name, :status, :message, keyword_init: true)
  Result = Struct.new(:passed, :checks, keyword_init: true) do
    def blocking_failures
      checks.select { |c| c.status == :failed }
    end
  end

  def initialize(environment)
    @env = environment
    @customer = environment.local_project.local_customer
  end

  # Runs all pre-deployment checks and returns an aggregate result.
  # Deployment is blocked if any check with severity "block" fails.
  #
  # @return [Result]
  def run
    checks = [
      check_cloud_account_linked,
      check_business_rules,
      check_cross_env_references,
      check_encryption_compliance,
      check_iam_least_privilege,
      check_module_renderers
    ]

    Result.new(
      passed: checks.none? { |c| c.status == :failed },
      checks: checks
    )
  end

  private

  # Checks that the canvas environment is linked to a cloud account.
  # Without this, the pipeline cannot target any infrastructure.
  def check_cloud_account_linked
    account_id = @env.aws_account_id || @env.azure_subscription_id || @env.gcp_project_id

    if account_id.present?
      CheckResult.new(
        name: "Cloud account linked",
        status: :passed,
        message: "Linked to #{account_id}"
      )
    else
      CheckResult.new(
        name: "Cloud account linked",
        status: :failed,
        message: "Canvas is not linked to a cloud account — go to the project page and link it first"
      )
    end
  end

  # Validates all resources against applicable business rules.
  def check_business_rules
    resources = @env.resources.includes(:module_definition)
    violations = []
    rule_count = BusinessRule.enabled
                             .for_cloud_provider(@env.cloud_provider)
                             .count

    resources.find_each do |resource|
      zone = resource.zone || "private"
      result = PlacementValidatorService.validate(resource.module_definition, zone, @customer)

      result.errors.each do |err|
        violations << "#{resource.name}: #{err[:message]}"
      end
    end

    if violations.any?
      CheckResult.new(
        name: "Business rules validation",
        status: :failed,
        message: "#{violations.size} violation(s): #{violations.first(3).join('; ')}"
      )
    else
      CheckResult.new(
        name: "Business rules validation",
        status: :passed,
        message: "#{rule_count}/#{rule_count} rules passed"
      )
    end
  end

  # Checks that cross-environment dependency references are resolvable.
  # Resources referencing outputs from other environments/layers must have
  # valid connection targets.
  def check_cross_env_references
    resources = @env.resources.includes(:module_definition)
    resource_ids = resources.pluck(:id)

    # Find dependency connections where the target is outside this environment
    dangling = Connection.where(connection_type: "dependency", from_resource_id: resource_ids)
                         .where.not(to_resource_id: resource_ids)

    if dangling.exists?
      names = dangling.limit(3).map { |c| "resource ##{c.from_resource_id} → ##{c.to_resource_id}" }
      CheckResult.new(
        name: "Cross-env references",
        status: :failed,
        message: "#{dangling.count} unresolvable reference(s): #{names.join(', ')}"
      )
    else
      CheckResult.new(
        name: "Cross-env references",
        status: :passed,
        message: "All outputs resolvable"
      )
    end
  end

  # Checks encryption compliance for storage resources.
  def check_encryption_compliance
    storage_types = %w[s3 ebs rds efs s3_bucket]
    resources = @env.resources.includes(:module_definition)
                    .where(module_definitions: { category: "storage" })
                    .or(
                      @env.resources.includes(:module_definition)
                          .where(module_definitions: { name: storage_types })
                    )

    unencrypted = []
    resources.find_each do |resource|
      encryption = resource.config&.dig("encryption") ||
                   resource.config&.dig("encrypt") ||
                   resource.config&.dig("kms_key_id").present?

      unless encryption
        unencrypted << resource.name
      end
    end

    if unencrypted.any?
      CheckResult.new(
        name: "Encryption compliance",
        status: :failed,
        message: "#{unencrypted.first(3).map { |n| "\"#{n}\"" }.join(', ')} missing encryption"
      )
    else
      CheckResult.new(
        name: "Encryption compliance",
        status: :passed,
        message: "All storage resources encrypted"
      )
    end
  end

  # Checks for wildcard IAM permissions in resource configs.
  def check_iam_least_privilege
    iam_resources = @env.resources.includes(:module_definition)
                        .where(module_definitions: { name: %w[iam_role iam_policy iam_user] })

    wildcards = []
    iam_resources.find_each do |resource|
      policy = resource.config&.dig("policy") || resource.config&.dig("inline_policy") || ""
      policy_str = policy.is_a?(Hash) ? policy.to_json : policy.to_s

      if policy_str.include?("*") && policy_str.include?("Action")
        wildcards << resource.name
      end
    end

    if wildcards.any?
      CheckResult.new(
        name: "IAM least privilege",
        status: :failed,
        message: "Wildcard permissions detected in: #{wildcards.first(3).join(', ')}"
      )
    else
      CheckResult.new(
        name: "IAM least privilege",
        status: :passed,
        message: "No wildcard permissions detected"
      )
    end
  end

  # Checks that all resources have a module renderer for the environment's IaC engine.
  def check_module_renderers
    missing = []
    @env.resources.includes(module_definition: :module_renderers).find_each do |resource|
      renderer = resource.module_definition.module_renderers.find { |r| r.engine == @env.iac_engine }
      missing << resource.name unless renderer
    end

    if missing.any?
      CheckResult.new(
        name: "Module renderer compatibility",
        status: :failed,
        message: "#{missing.size} resource(s) missing #{@env.iac_engine} renderer: #{missing.first(3).join(', ')}"
      )
    else
      CheckResult.new(
        name: "Module renderer compatibility",
        status: :passed,
        message: "All resources have #{@env.iac_engine} renderers"
      )
    end
  end
end
