# frozen_string_literal: true

class ResellersController < AuthenticatedController
  # GET /resellers
  def index
    # Only platform admins need the reseller picker.
    # Reseller admins already have a reseller_uuid — send them to customers.
    # Customer-scoped users go straight to their customer.
    if current_user.reseller_admin?
      redirect_to customers_path and return
    end

    unless current_user.platform_admin?
      redirect_to customers_path and return
    end

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
