# frozen_string_literal: true

module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :set_current_user
    helper_method :current_user, :logged_in?
  end

  # Enforce authentication — use as a before_action in controllers that require login
  def require_authentication
    return if logged_in?

    session[:return_to] = request.fullpath
    redirect_to login_path
  end

  # Returns the current user built from session data, or nil
  def current_user
    return @current_user if defined?(@current_user)

    @current_user = build_user_from_session
  end

  # Whether a user is currently authenticated
  def logged_in?
    current_user.present?
  end

  private

  # Set Current.user on every request so it's available app-wide
  def set_current_user
    Current.user = current_user
  end

  # Build a User value object from session data stored during Keycloak callback
  def build_user_from_session
    return nil unless session[:user_uuid].present?

    user = User.new(
      uuid: session[:user_uuid],
      sub: session[:sub],
      email: session[:user_email],
      name: session[:user_name],
      reseller_uuid: session[:reseller_uuid],
      customer_uuid: session[:customer_uuid]
    )
    user.roles = session[:roles] || []
    user
  end
end
