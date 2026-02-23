redis_url = ENV.fetch("REDIS_URL", "redis://localhost:6379/0")
redis_config = {
  url: redis_url,
  expire_after: 1.day,
  key_prefix: "factorfifty:session:"
}

# AWS ElastiCache/Valkey with TLS
if redis_url.start_with?("rediss://")
  redis_config[:ssl_params] = { verify_mode: OpenSSL::SSL::VERIFY_NONE }
end

Rails.application.config.session_store :redis_session_store,
  key: "_factorfifty_session",
  redis: redis_config,
  on_redis_down: ->(e, _env, _sid) { Rails.logger.error("Redis session error: #{e.class}: #{e.message}") }
