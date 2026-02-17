# frozen_string_literal: true

class ProjectsController < AuthenticatedController
  before_action :set_client
  before_action :set_customer

  # GET /customers/:customer_uuid/projects/new
  def new
    authorize!(:manage, Project.new(customer_uuid: @customer.uuid))
    @project = Project.new(customer_uuid: @customer.uuid)
  end

  # POST /customers/:customer_uuid/projects
  def create
    authorize!(:manage, Project.new(customer_uuid: @customer.uuid))

    attrs = {
      name: project_params[:name],
      customer_uuid: @customer.uuid,
      provider: project_params[:provider],
      region: project_params[:region],
      status: "unknown"
    }

    response = @client.create_project(attrs)
    if response.success?
      redirect_to customer_path(@customer.uuid), notice: "Project created."
    else
      redirect_to customer_path(@customer.uuid), alert: "Could not create project: #{response.error}"
    end
  end

  # GET /customers/:customer_uuid/projects/:uuid
  def show
    response = @client.get_project(uuid: params[:uuid])
    if response.success?
      @project = Project.from_api(response.data)
      authorize!(:read, @project)

      # Load environments for this project
      env_response = @client.list_environments(project_uuid: @project.uuid)
      @environments = if env_response.success?
                        Array(env_response.data).map { |attrs| Environment.from_api(attrs) }
                      else
                        []
                      end
    else
      redirect_to customer_path(@customer.uuid), alert: "Project not found."
    end
  end

  # JSON endpoint for regions filtered by provider
  # GET /customers/:customer_uuid/projects/regions?cloud_provider=AWS
  def regions
    response = @client.list_regions(cloud_provider: params[:cloud_provider])
    if response.success?
      render json: Array(response.data)
    else
      render json: [], status: :unprocessable_entity
    end
  end

  private

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

  def project_params
    params.require(:project).permit(:name, :provider, :region)
  end
end
