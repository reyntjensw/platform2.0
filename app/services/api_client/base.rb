# frozen_string_literal: true

module ApiClient
  class Base
    class << self
      def connection(base_url, timeout: 30, headers: {})
        Faraday.new(url: base_url, headers: headers) do |f|
          f.request  :json
          f.response :json, parser_options: { symbolize_names: true }
          f.request  :retry, max: 3, interval: 0.5,
                     interval_randomness: 0.5, backoff_factor: 2,
                     exceptions: [Faraday::TimeoutError, Faraday::ConnectionFailed]
          f.options.open_timeout = 5
          f.options.timeout = timeout
          f.response :logger, Rails.logger, bodies: Rails.env.development? if defined?(Rails)
        end
      end
    end

    private

    def get(path, params = {})
      wrap { conn.get(path, params) }
    end

    def post(path, body = {})
      wrap { conn.post(path, body) }
    end

    def put(path, body = {})
      wrap { conn.put(path, body) }
    end

    def delete(path, params = {})
      wrap { conn.delete(path) { |req| req.params = params } }
    end

    def wrap
      response = yield
      Response.new(status: response.status, body: response.body)
    rescue Faraday::TimeoutError => e
      Response.new(status: 0, error: "Request timed out: #{e.message}")
    rescue Faraday::ConnectionFailed => e
      Response.new(status: 0, error: "Connection failed: #{e.message}")
    rescue Faraday::Error => e
      Response.new(status: 0, error: "Request error: #{e.message}")
    rescue StandardError => e
      Response.new(status: 0, error: "Unexpected error: #{e.message}")
    end
  end
end
