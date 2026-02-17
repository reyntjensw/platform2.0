# frozen_string_literal: true

class EnvironmentsController < AuthenticatedController
  before_action :set_clients
  before_action :set_customer
  before_action :set_project

  # POST /customers/:customer_uuid/projects/:project_uuid/environments/validate
  # JSON endpoint — validates AWS role via role-manager
  def validate
    result = @role_manager.validate_account(
      account_id: params[:account_id].to_s.strip,
      external_id: params[:external_id].to_s.strip,
      role_name: params[:role_name].to_s.strip
    )

    if result.success?
      render json: { valid: true, data: result.data }
    else
      render json: { valid: false, error: result.error || result.data }, status: :unprocessable_entity
    end
  end

  # POST /customers/:customer_uuid/projects/:project_uuid/environments
  def create
    authorize!(:manage, Environment.new(project_uuid: @project.uuid))

    if @project.provider&.downcase == "azure"
      create_azure_environment
    else
      create_aws_environment
    end
  end

  private

  def create_aws_environment
    role_types = []
    role_types << "readonly"
    role_types << "finops" if params[:finops_enabled] == "1"
    role_types << "secops" if params[:secops_enabled] == "1"
    role_types << "docops"

    sla = params[:sla] || "production"
    monitoring = %w[production non_production].include?(sla)

    role_types << "monitoring" if monitoring

    account_id   = params[:account_id].to_s.strip
    role_name    = params[:role_name].to_s.strip
    external_id  = params[:external_id].to_s.strip
    env_name     = params[:environment_name].to_s.strip

    # 1. Register with role-manager
    register_response = @role_manager.register_account(
      customer_uuid: @customer.uuid,
      project_uuid: @project.uuid,
      aws_account_id: account_id,
      external_id: external_id,
      role_name: role_name,
      role_types: role_types,
      sla: sla
    )

    Rails.logger.info "Role-manager register response: #{register_response}"

    unless register_response.success?
      redirect_to customer_project_path(@customer.uuid, @project.uuid),
                  alert: "Registration failed: #{register_response.error || register_response.data}"
      return
    end

    # 2. Create environment in internal API
    env_attrs = {
      project_uuid: @project.uuid,
      name: env_name.presence || account_id,
      environment_type: sla,
      account_id: account_id
    }

    Rails.logger.info "Creating environment in internal API: #{env_attrs}"
    env_response = @client.create_environment(env_attrs)
    Rails.logger.info "Internal API create_environment response: #{env_response}"

    if env_response.success?
      redirect_to customer_project_path(@customer.uuid, @project.uuid),
                  notice: "Environment created and registered."
    else
      redirect_to customer_project_path(@customer.uuid, @project.uuid),
                  alert: "Registered but failed to save environment: #{env_response.error}"
    end
  end

  def create_azure_environment
    sla = params[:sla].to_s.strip.presence || "production"
    monitoring = %w[production non_production].include?(sla)

    enabled_role_types = []
    enabled_role_types << "finops" if params[:finops_enabled] == "1"
    enabled_role_types << "secops" if params[:secops_enabled] == "1"
    enabled_role_types << "monitoring" if monitoring

    subscription_id       = params[:subscription_id].to_s.strip
    tenant_id             = params[:tenant_id].to_s.strip
    admin_credential_id   = params[:admin_credential_id].to_s.strip.presence
    ro_credential_id      = params[:read_only_credential_id].to_s.strip
    env_name              = params[:environment_name].to_s.strip

    # 1. Link subscription via platform API (single call with both credentials)
    link_response = @platform.link_subscription(
      customer_uuid: @customer.uuid,
      project_uuid: @project.uuid,
      subscription_id: subscription_id,
      tenant_id: tenant_id,
      admin_credential_id: admin_credential_id,
      read_only_credential_id: ro_credential_id,
      enabled_role_types: enabled_role_types
    )

    Rails.logger.info "Platform link_subscription response: #{link_response.inspect}"

    unless link_response.success?
      render json: { success: false, error: "Failed to link subscription: #{link_response.error}" },
             status: :unprocessable_entity
      return
    end

    # 2. Create environment in internal API
    env_attrs = {
      project_uuid: @project.uuid,
      name: env_name.presence || subscription_id,
      environment_type: sla,
      account_id: subscription_id
    }

    Rails.logger.info "Creating Azure environment in internal API: #{env_attrs}"
    env_response = @client.create_environment(env_attrs)
    Rails.logger.info "Internal API create_environment response: #{env_response.inspect}"

    if env_response.success?
      render json: { success: true }
    else
      render json: { success: false, error: "Failed to save environment: #{env_response.error}" },
             status: :unprocessable_entity
    end
  end

  def set_clients
    @client = CsInternalApiClient.new
    @role_manager = RoleManagerClient.new
    @platform = PlatformApiClient.new
  end

  def set_customer
    response = @client.get_customer(uuid: params[:customer_uuid])
    if response.success?
      @customer = Customer.from_api(response.data)
    else
      redirect_to customers_path, alert: "Customer not found."
    end
  end

  def set_project
    response = @client.get_project(uuid: params[:project_uuid])
    if response.success?
      @project = Project.from_api(response.data)
    else
      redirect_to customer_path(params[:customer_uuid]), alert: "Project not found."
    end
  end
end
