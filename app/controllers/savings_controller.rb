# frozen_string_literal: true

class SavingsController < AuthenticatedController
  before_action :set_customer

  # GET /customers/:customer_uuid/savings
  def index
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
end
