# frozen_string_literal: true

module Auth
  class SessionsController < ApplicationController
    # create (callback from Keycloak)
    def create
      auth_hash = request.env["omniauth.auth"]

      unless auth_hash
        redirect_to root_path, alert: "Authentication failed"
        return
      end

      # Extract user info from Keycloak token
      uid = auth_hash["uid"]
      info = auth_hash["info"] || {}
      raw_info = auth_hash.dig("extra", "raw_info") || {}

      # Store identity in session
      session[:user_uuid] = uid
      session[:sub] = uid
      session[:user_email] = info["email"]
      session[:user_name] = info["name"]
      session[:roles] = raw_info.dig("realm_access", "roles") || []
      session[:groups] = raw_info["groups"] || []

      # Derive reseller_uuid from Keycloak groups (e.g. "/resellers/cloudsisters/...")
      session[:reseller_uuid] = extract_reseller_uuid(session[:groups])

      redirect_to session.delete(:return_to) || root_path, notice: "Signed in successfully"
    end

    # destroy (logout)
    def destroy
      logout_url = keycloak_logout_url
      reset_session
      redirect_to logout_url, allow_other_host: true
    end

    # failure (OmniAuth failure callback)
    def failure
      redirect_to root_path, alert: "Authentication failed: #{params[:message] || 'Unknown error'}", only_path: true
    end

    private

    def keycloak_logout_url
      base = ENV.fetch("KEYCLOAK_URL", "http://localhost:8080")
      realm = ENV.fetch("KEYCLOAK_REALM", "factorfifty")
      client_id = ENV.fetch("KEYCLOAK_CLIENT_ID", "f50-rails-app")
      redirect_uri = CGI.escape(root_url)

      "#{base}/realms/#{realm}/protocol/openid-connect/logout?client_id=#{client_id}&post_logout_redirect_uri=#{redirect_uri}"
    end

    def extract_reseller_uuid(groups)
      # Keycloak groups follow pattern: /resellers/<reseller_name>/...
      # Find the first group matching this pattern and extract the reseller identifier
      reseller_group = groups.find { |g| g.start_with?("/resellers/") }
      return nil unless reseller_group

      # Extract the reseller segment: /resellers/cloudsisters/... → cloudsisters
      parts = reseller_group.split("/").reject(&:empty?)
      parts[1] if parts.length >= 2
    end
  end
end
