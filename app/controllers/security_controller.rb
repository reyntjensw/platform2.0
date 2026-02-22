# frozen_string_literal: true

class SecurityController < AuthenticatedController
  before_action :set_customer
  before_action :set_environment

  # GET /customers/:customer_uuid/security/:environment_uuid
  def show
  end

  private

  def set_customer
    client = CsInternalApiClient.new
    response = client.get_customer(uuid: params[:customer_uuid])

    if response.success?
      @customer = Customer.from_api(response.data)
    else
      head :not_found
    end
  end

  def set_environment
    client = CsInternalApiClient.new
    # Find the environment by UUID — we need the project context too
    @environment_uuid = params[:environment_uuid]
    @environment_name = params[:env_name] || "Environment"
    @project_name = params[:project_name] || "Project"
  end
end
