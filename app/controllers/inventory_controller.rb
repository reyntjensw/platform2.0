# frozen_string_literal: true

class InventoryController < AuthenticatedController
  before_action :set_customer
  before_action :set_environment

  # GET /customers/:customer_uuid/inventory/:environment_uuid
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
    @environment_uuid = params[:environment_uuid]
    @environment_name = params[:env_name] || "Environment"
    @project_name = params[:project_name] || "Project"
    @account_id = params[:account_id]
  end
end
