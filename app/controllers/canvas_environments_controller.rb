# frozen_string_literal: true

class CanvasEnvironmentsController < AuthenticatedController
  before_action :set_client
  before_action :set_customer
  before_action :set_project
  before_action :set_canvas_environment, only: [:destroy, :link, :unlink]

  # POST /customers/:customer_uuid/projects/:project_uuid/canvas_environments
  def create
    local_project = find_or_create_local_project

    env = local_project.local_environments.new(canvas_env_params)
    env.cloud_provider = @project.provider&.downcase || "aws"
    env.region = @project.region.presence || local_project.default_region || "eu-west-1"
    env.iac_engine = "opentofu"
    env.execution_mode = "platform"

    # Auto-link to platform environment if account_id is provided
    if params[:account_id].present?
      account_id = params[:account_id].to_s.strip
      if env.cloud_provider == "azure"
        env.azure_subscription_id = account_id
      else
        env.aws_account_id = account_id
      end
    end

    if env.save
      redirect_to customer_project_path(@customer.uuid, @project.uuid),
                  notice: "Canvas environment '#{env.name}' created."
    else
      redirect_to customer_project_path(@customer.uuid, @project.uuid),
                  alert: "Failed to create canvas: #{env.errors.full_messages.join(', ')}"
    end
  end

  # DELETE /customers/:customer_uuid/projects/:project_uuid/canvas_environments/:id
  def destroy
    name = @canvas_env.name
    @canvas_env.destroy!
    redirect_to customer_project_path(@customer.uuid, @project.uuid),
                notice: "Canvas environment '#{name}' deleted."
  end

  # PATCH /customers/:customer_uuid/projects/:project_uuid/canvas_environments/:id/link
  # Links a platform environment (by account_id) to this canvas environment.
  def link
    account_id = params[:account_id].to_s.strip
    if account_id.blank?
      redirect_to customer_project_path(@customer.uuid, @project.uuid),
                  alert: "Account ID is required for linking."
      return
    end

    if @canvas_env.cloud_provider == "azure"
      @canvas_env.update!(azure_subscription_id: account_id)
    else
      @canvas_env.update!(aws_account_id: account_id)
    end

    redirect_to customer_project_path(@customer.uuid, @project.uuid),
                notice: "Canvas '#{@canvas_env.name}' linked to account #{account_id}."
  end

  # PATCH /customers/:customer_uuid/projects/:project_uuid/canvas_environments/:id/unlink
  def unlink
    @canvas_env.update!(aws_account_id: nil, azure_subscription_id: nil, aws_role_arn: nil, gcp_project_id: nil)
    redirect_to customer_project_path(@customer.uuid, @project.uuid),
                notice: "Canvas '#{@canvas_env.name}' unlinked from platform environment."
  end

  private

  def canvas_env_params
    params.require(:canvas_environment).permit(:name, :env_type)
  end

  def set_canvas_environment
    @canvas_env = LocalEnvironment.find(params[:id])
  end

  def find_or_create_local_project
    # Find or create the local mirror of this project
    customer = find_or_create_local_customer
    LocalProject.find_or_create_by!(slug: @project.uuid, local_customer: customer) do |p|
      p.name = @project.name
      p.cloud_provider = @project.provider&.downcase || "aws"
      p.default_region = canvas_env_params[:region]
    end
  end

  def find_or_create_local_customer
    reseller = LocalReseller.find_or_create_by!(slug: "default") do |r|
      r.name = "Default"
    end
    LocalCustomer.find_or_create_by!(slug: @customer.uuid, local_reseller: reseller) do |c|
      c.name = @customer.name
    end
  end

  def set_client
    @client = CsInternalApiClient.new
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
