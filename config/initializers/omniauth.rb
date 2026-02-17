require "omniauth"
require "omniauth/strategies/keycloak-openid"

Rails.application.config.middleware.use OmniAuth::Builder do
  provider(
    OmniAuth::Strategies::KeycloakOpenId,
    ENV.fetch("KEYCLOAK_CLIENT_ID", "f50-rails-app"),
    ENV.fetch("KEYCLOAK_CLIENT_SECRET", "changeme"),
    client_options: {
      site: ENV.fetch("KEYCLOAK_URL", "http://localhost:8080"),
      realm: ENV.fetch("KEYCLOAK_REALM", "factorfifty"),
      base_url: ""  # Keycloak 17+ (Quarkus) doesn't use /auth prefix
    },
    name: "keycloak",
    callback_path: "/auth/keycloak/callback",
    scope: "openid profile email"
  )
end

OmniAuth.config.allowed_request_methods = %i[post get]
OmniAuth.config.silence_get_warning = true
