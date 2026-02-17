Rails.application.config.session_store :redis_session_store,
  key: "_factorfifty_session",
  redis: {
    expire_after: 1.day,
    key_prefix: "factorfifty:session:",
    url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0")
  }
