# frozen_string_literal: true

class ResellersController < AuthenticatedController
  # GET /resellers
  def index
    # Only platform admins need the reseller picker.
    # Reseller admins already have a reseller_uuid — send them to customers.
    # Customer-scoped users go straight to their customer.
    if current_user.customer_scoped?
      redirect_to customer_path(current_user.customer_uuid) and return
    end

    if current_user.reseller_admin?
      redirect_to customers_path and return
    end

    require_platform_admin

    client = CsInternalApiClient.new
    response = client.list_resellers
    if response.success?
      @resellers = Array(response.data).map { |attrs| Reseller.from_api(attrs) }
    else
      @resellers = []
      flash.now[:error] = "Could not load resellers: #{response.error}"
    end
  end
end
