# frozen_string_literal: true

class KeycloakUsersController < AuthenticatedController
  before_action :set_client
  before_action :set_keycloak_user, only: [:edit, :update, :destroy]

  # GET /users
  def index
    response = fetch_scoped_users
    if response.success?
      @users = Array(response.data).map { |attrs| build_keycloak_user(attrs) }
    else
      @users = []
      flash.now[:error] = "Could not load users: #{response.error}"
    end

    # Load form data for inline edit modals
    load_form_data if authorized?(:manage, :keycloak_users)
  end

  # GET /users/new
  def new
    authorize!(:manage, :keycloak_users)
    @keycloak_user = KeycloakUser.new
    load_form_data
  end

  # POST /users
  def create
    authorize!(:manage, :keycloak_users)

    @keycloak_user = KeycloakUser.new(keycloak_user_params)
    errors = validate_required_fields

    if errors.any?
      return render json: { errors: errors }, status: :unprocessable_entity if request.xhr? || request.content_type&.include?("json")
      load_form_data
      flash.now[:error] = errors.join(", ")
      render :new, status: :unprocessable_entity
      return
    end

    attrs = {
      email: @keycloak_user.email,
      first_name: @keycloak_user.first_name,
      last_name: @keycloak_user.last_name,
      customer_uuid: resolve_customer_uuid,
      reseller_uuid: resolve_reseller_uuid
    }

    response = @client.create_keycloak_user(attrs)

    if response.success?
      user_id = response.data[:id] || response.data["id"]
      role = params.dig(:keycloak_user, :role)
      if role.present? && user_id
        @client.assign_keycloak_user_roles(user_id: user_id, role_names: [role])
      end
      if request.xhr? || request.content_type&.include?("json")
        render json: { redirect: keycloak_users_path }, status: :ok
      else
        redirect_to keycloak_users_path, notice: "User created successfully."
      end
    elsif response.status == 409
      error_msg = "Email is already in use"
      return render json: { errors: [error_msg] }, status: :unprocessable_entity if request.xhr? || request.content_type&.include?("json")
      load_form_data
      flash.now[:error] = error_msg
      render :new, status: :unprocessable_entity
    else
      error_msg = response.error || "Could not create user"
      return render json: { errors: [error_msg] }, status: :unprocessable_entity if request.xhr? || request.content_type&.include?("json")
      load_form_data
      flash.now[:error] = "Could not create user: #{response.error}"
      render :new, status: :unprocessable_entity
    end
  end

  # GET /users/customers_for_reseller?reseller_uuid=xxx
  def customers_for_reseller
    reseller_uuid = params[:reseller_uuid]
    if reseller_uuid.present?
      response = @client.list_customers(reseller_uuid: reseller_uuid)
      if response.success?
        render json: Array(response.data).map { |c| { uuid: c[:uuid] || c["uuid"], name: c[:name] || c["name"] } }
      else
        render json: [], status: :unprocessable_entity
      end
    else
      render json: []
    end
  end

  # GET /users/:id/edit
  def edit
    authorize!(:manage, :keycloak_users)
    load_form_data
  end

  # PATCH/PUT /users/:id
  def update
    authorize!(:manage, :keycloak_users)

    attrs = {
      email: params.dig(:keycloak_user, :email),
      first_name: params.dig(:keycloak_user, :first_name),
      last_name: params.dig(:keycloak_user, :last_name),
      enabled: params.dig(:keycloak_user, :enabled) == "1"
    }

    response = @client.update_keycloak_user(id: @keycloak_user.id, attrs: attrs)

    if response.success?
      sync_roles
      if request.xhr? || request.content_type&.include?("json")
        render json: { redirect: keycloak_users_path }, status: :ok
      else
        redirect_to keycloak_users_path, notice: "User updated successfully."
      end
    else
      error_msg = response.error || "Could not update user"
      return render json: { errors: [error_msg] }, status: :unprocessable_entity if request.xhr? || request.content_type&.include?("json")
      @errors = [error_msg]
      load_form_data
      flash.now[:error] = "Could not update user: #{response.error}"
      render :edit, status: :unprocessable_entity
    end
  end

  # DELETE /users/:id
  def destroy
    authorize!(:manage, :keycloak_users)

    response = @client.delete_keycloak_user(id: @keycloak_user.id)

    if response.success?
      redirect_to keycloak_users_path, notice: "User deleted successfully."
    else
      redirect_to keycloak_users_path, alert: "Could not delete user: #{response.error}"
    end
  end



  private

  def set_client
    @client = CsInternalApiClient.new
  end

  def set_keycloak_user
    response = @client.get_keycloak_user(id: params[:id])
    if response.success?
      @keycloak_user = KeycloakUser.from_api(response.data)
      roles_response = @client.get_keycloak_user_roles(user_id: @keycloak_user.id)
      @keycloak_user.roles = Array(roles_response.data).map { |r| r[:name] || r["name"] } if roles_response.success?
    else
      redirect_to keycloak_users_path, alert: "User not found."
    end
  end

  def sync_roles
    new_role = params.dig(:keycloak_user, :role)
    return if new_role.blank?

    old_roles = @keycloak_user.roles
    return if old_roles == [new_role]

    @client.remove_keycloak_user_roles(user_id: @keycloak_user.id, role_names: old_roles) if old_roles.any?
    @client.assign_keycloak_user_roles(user_id: @keycloak_user.id, role_names: [new_role])
  end


  def fetch_scoped_users
    if current_user.platform_admin?
      @client.list_keycloak_users
    elsif current_user.reseller_admin?
      @client.list_keycloak_users(reseller_uuid: current_user.reseller_uuid)
    else
      @client.list_keycloak_users(customer_uuid: current_user.customer_uuid)
    end
  end

  def build_keycloak_user(attrs)
    user = KeycloakUser.from_api(attrs)
    roles_response = @client.get_keycloak_user_roles(user_id: user.id)
    user.roles = Array(roles_response.data).map { |r| r[:name] || r["name"] } if roles_response.success?
    user
  end

  def assignable_roles
    if current_user.platform_admin?
      %w[platform_admin reseller_admin customer_admin customer_viewer]
    elsif current_user.reseller_admin?
      %w[customer_admin customer_viewer]
    elsif current_user.customer_admin?
      %w[customer_viewer]
    else
      []
    end
  end

  def load_form_data
    @assignable_roles = assignable_roles
    @resellers = load_resellers_for_form
    @customers = load_customers_for_form
  end

  def load_resellers_for_form
    return [] unless current_user.platform_admin?

    response = @client.list_resellers
    response.success? ? Array(response.data) : []
  end

  def load_customers_for_form
    if current_user.platform_admin?
      # For edit mode, pre-load customers for the user's reseller
      if @keycloak_user&.reseller_uuid.present?
        response = @client.list_customers(reseller_uuid: @keycloak_user.reseller_uuid)
        return response.success? ? Array(response.data) : []
      end
      # For new mode, customers loaded via cascading dropdown
      []
    elsif current_user.reseller_admin?
      response = @client.list_customers(reseller_uuid: current_user.reseller_uuid)
      response.success? ? Array(response.data) : []
    else
      []
    end
  end

  def keycloak_user_params
    params.require(:keycloak_user).permit(:email, :first_name, :last_name, :customer_uuid, :reseller_uuid)
  end

  def validate_required_fields
    errors = []
    errors << "Email is required" if @keycloak_user.email.blank?
    errors << "First name is required" if @keycloak_user.first_name.blank?
    errors << "Last name is required" if @keycloak_user.last_name.blank?
    errors + validate_role_scope_consistency
  end

  # Ensure the assigned role matches the scope (UUIDs) being set.
  # Prevents accidental privilege escalation (e.g. creating a platform_admin
  # without explicit intent, or a scoped role without proper UUIDs).
  def validate_role_scope_consistency
    errors = []
    role = params.dig(:keycloak_user, :role)
    customer_uuid = resolve_customer_uuid
    reseller_uuid = resolve_reseller_uuid

    case role
    when "platform_admin"
      # Only platform admins can create other platform admins
      unless current_user.platform_admin?
        errors << "Only platform admins can assign the platform_admin role"
      end
      # Platform admins must not be scoped to a customer or reseller
      if customer_uuid.present? || reseller_uuid.present?
        errors << "Platform admins must not be scoped to a reseller or customer"
      end
    when "reseller_admin"
      errors << "Reseller admin requires a reseller_uuid" if reseller_uuid.blank?
      if customer_uuid.present?
        errors << "Reseller admins must not be scoped to a customer"
      end
    when "customer_admin", "customer_viewer"
      errors << "#{role.humanize} requires a reseller_uuid" if reseller_uuid.blank?
      errors << "#{role.humanize} requires a customer_uuid" if customer_uuid.blank?
    when nil, ""
      errors << "A role must be assigned to the user"
    else
      errors << "Unknown role: #{role}"
    end

    errors
  end

  def resolve_customer_uuid
    if current_user.customer_scoped?
      current_user.customer_uuid
    else
      params.dig(:keycloak_user, :customer_uuid)
    end
  end

  def resolve_reseller_uuid
    if current_user.reseller_admin?
      current_user.reseller_uuid
    elsif current_user.customer_scoped?
      current_user.reseller_uuid
    else
      params.dig(:keycloak_user, :reseller_uuid)
    end
  end
end
