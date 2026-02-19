# frozen_string_literal: true

class AzureCredentialsController < AuthenticatedController
  before_action :set_clients
  before_action :set_customer
  before_action :set_project

  # GET /customers/:customer_uuid/projects/:project_uuid/azure_credentials
  # JSON — returns credentials list for this customer
  def index
    response = @platform.list_azure(customer_uuid: @customer.uuid)
    if response.success?
      by_tenant = response.data.is_a?(Hash) ? (response.data[:by_tenant] || {}) : {}
      render json: { by_tenant: by_tenant }
    else
      render json: { by_tenant: {}, error: response.error }, status: :unprocessable_entity
    end
  end

  # POST /customers/:customer_uuid/projects/:project_uuid/azure_credentials/test
  # JSON — tests Azure credentials (raw or stored by credential_id)
  def test
    if params[:credential_id].present?
      # Test a stored credential — look up secret from SSM and test
      Rails.logger.info "Testing stored credential: customer=#{@customer.uuid}, tenant=#{params[:tenant_id]}, cred=#{params[:credential_id]}"
      result = @platform.get_azure_with_secret(
        customer_uuid: @customer.uuid,
        tenant_id: params[:tenant_id].to_s.strip,
        credential_id: params[:credential_id].to_s.strip
      )
    else
      result = @platform.test_azure(
        tenant_id:   params[:tenant_id].to_s.strip,
        client_id:   params[:client_id].to_s.strip,
        client_secret: params[:client_secret].to_s.strip
      )
    end

    if result.success?
      data = result.data.is_a?(Hash) ? result.data : {}
      render json: { success: true, data: data }
    else
      error_msg = result.error || result.data
      if error_msg.is_a?(Hash)
        error_msg = error_msg[:detail] || error_msg["detail"] || error_msg.to_s
      end
      render json: { success: false, error: error_msg || "Authentication failed" }, status: :unprocessable_entity
    end
  end

  # POST /customers/:customer_uuid/projects/:project_uuid/azure_credentials
  # JSON — saves a credential
  def create
    authorize!(:manage, @project)

    attrs = {
      customer_uuid:   @customer.uuid,
      tenant_id:       params[:tenant_id].to_s.strip,
      client_id:       params[:client_id].to_s.strip,
      client_secret:   params[:client_secret].to_s.strip,
      credential_type: params[:credential_type] || "read_only",
      name:            params[:name].to_s.strip.presence,
      expiration_date: params[:expiration_date].to_s.strip.presence
    }.compact

    response = @platform.save_azure(**attrs)
    if response.success?
      render json: { success: true, data: response.data }
    else
      render json: { success: false, error: response.error || response.data }, status: :unprocessable_entity
    end
  end

  # PATCH /customers/:customer_uuid/projects/:project_uuid/azure_credentials/:id
  # JSON — updates a credential
  def update
    authorize!(:manage, @project)

    attrs = {
      customer_uuid: @customer.uuid,
      credential_id: params[:id]
    }
    attrs[:name]            = params[:name].to_s.strip            if params[:name].present?
    attrs[:expiration_date] = params[:expiration_date].to_s.strip if params[:expiration_date].present?
    attrs[:client_id]       = params[:client_id].to_s.strip       if params[:client_id].present?
    attrs[:client_secret]   = params[:client_secret].to_s.strip   if params[:client_secret].present?

    response = @platform.update_azure(**attrs)
    if response.success?
      render json: { success: true, data: response.data }
    else
      render json: { success: false, error: response.error || response.data }, status: :unprocessable_entity
    end
  end

  # DELETE /customers/:customer_uuid/projects/:project_uuid/azure_credentials/:id
  # JSON — deletes a credential
  def destroy
    authorize!(:manage, @project)

    response = @platform.delete_azure(
      customer_uuid: @customer.uuid,
      credential_id: params[:id]
    )
    if response.success?
      render json: { success: true }
    else
      render json: { success: false, error: response.error || response.data }, status: :unprocessable_entity
    end
  end

  # POST /customers/:customer_uuid/projects/:project_uuid/azure_credentials/expiring
  # JSON — returns expiring credentials
  def expiring
    response = @platform.expiring_azure(customer_uuid: @customer.uuid)
    if response.success?
      render json: { credentials: Array(response.data) }
    else
      render json: { credentials: [], error: response.error }, status: :unprocessable_entity
    end
  end

  private

  def set_clients
    @client   = CsInternalApiClient.new
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
      redirect_to customer_path(params[:customer_uuid]), alert: "Project not found.", only_path: true
    end
  end
end
