# frozen_string_literal: true

class GitCredentialsController < AuthenticatedController
  before_action :require_admin
  before_action :set_credential, only: [:update, :destroy, :verify, :rotate]

  # GET /settings/git_credentials
  def index
    @credentials = scoped_credentials.order(:name)
  end

  # POST /settings/git_credentials
  def create
    @credential = GitCredential.new(credential_params)
    @credential.owner = determine_owner

    if @credential.save
      flash[:notice] = "Credential created"
      redirect_to git_credentials_path
    else
      flash[:alert] = @credential.errors.full_messages.join(", ")
      redirect_to git_credentials_path
    end
  end

  # PATCH /settings/git_credentials/:id
  def update
    if @credential.update(credential_params.except(:token))
      flash[:notice] = "Credential updated"
    else
      flash[:alert] = @credential.errors.full_messages.join(", ")
    end
    redirect_to git_credentials_path
  end

  # DELETE /settings/git_credentials/:id
  def destroy
    renderer_count = @credential.module_renderers.count
    if renderer_count > 0 && params[:confirm] != "true"
      flash[:alert] = "This credential is used by #{renderer_count} module renderer(s). Add ?confirm=true to force delete."
      redirect_to git_credentials_path
      return
    end

    @credential.destroy!
    flash[:notice] = "Credential deleted"
    redirect_to git_credentials_path
  end

  # POST /settings/git_credentials/:id/verify
  def verify
    result = GitCredentialVerificationService.verify(@credential)
    render json: result
  end

  # PATCH /settings/git_credentials/:id/rotate
  def rotate
    if params[:token].blank?
      render json: { error: "New token is required" }, status: :unprocessable_entity
      return
    end

    @credential.update!(token: params[:token])
    result = GitCredentialVerificationService.verify(@credential)
    render json: result.merge(rotated: true)
  end

  private

  def set_credential
    @credential = scoped_credentials.find(params[:id])
  end

  def credential_params
    params.permit(:name, :host, :credential_type, :token, :ssh_private_key, :scope, :active, :expires_at)
  end

  def scoped_credentials
    owner = determine_owner
    if owner
      GitCredential.where(owner: owner)
    else
      GitCredential.all # platform_admin sees all
    end
  end

  def determine_owner
    if current_user.platform_admin?
      nil
    elsif current_user.reseller_admin?
      Reseller.find_by(uuid: current_user.reseller_uuid)
    elsif current_user.customer_admin?
      Customer.find_by(uuid: current_user.customer_uuid)
    end
  end

  def require_admin
    raise NotAuthorizedError, "Platform admin access required" unless current_user&.platform_admin?
  end
end
