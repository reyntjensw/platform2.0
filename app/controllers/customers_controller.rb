# frozen_string_literal: true

class CustomersController < AuthenticatedController
  before_action :set_client
  before_action :set_customer, only: :show

  # GET /customers?reseller_uuid=xxx
  def index
    # Customer-scoped users: redirect straight to their own customer
    if customer_scoped_user?
      redirect_to customer_path(current_user.customer_uuid) and return
    end

    reseller_uuid = params[:reseller_uuid] || current_user.reseller_uuid

    # Platform admins must pick a reseller first
    if reseller_uuid.blank?
      redirect_to resellers_path and return
    end

    authorize!(:read, Customer.new(reseller_uuid: reseller_uuid))

    response = @client.list_customers(reseller_uuid: reseller_uuid)
    if response.success?
      @customers = Array(response.data).map { |attrs| Customer.from_api(attrs) }
    else
      @customers = []
      flash.now[:error] = "Could not load customers: #{response.error}"
    end

    @reseller_uuid = reseller_uuid
  end

  # GET /customers/:uuid
  def show
    authorize!(:read, @customer)

    projects_response = @client.list_customer_projects_summary(
      customer_uuid: @customer.uuid,
      reseller_uuid: @customer.reseller_uuid
    )
    if projects_response.success?
      @projects = Array(projects_response.data).map { |attrs| Project.from_api(attrs) }
    else
      @projects = []
      flash.now[:error] = "Could not load projects: #{projects_response.error}"
    end
  end

  private

  def set_client
    @client = CsInternalApiClient.new
  end

  def set_customer
    response = @client.get_customer(uuid: params[:uuid])
    if response.success?
      @customer = Customer.from_api(response.data)
    else
      redirect_to customers_path, alert: "Customer not found."
    end
  end

  def customer_scoped_user?
    !current_user.platform_admin? &&
      !current_user.reseller_admin? &&
      current_user.customer_uuid.present?
  end
end
