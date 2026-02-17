# frozen_string_literal: true

class PipelineClient
  BASE_URL = ENV.fetch("PIPELINE_SERVICE_URL", "http://localhost:8000")
  TOKEN = ENV.fetch("PIPELINE_SERVICE_TOKEN", "dev-token")

  def initialize
    @conn = Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.response :json
      f.request :retry, max: 2, interval: 0.5
      f.adapter Faraday.default_adapter
      f.headers["X-Service-Token"] = TOKEN
      f.options.timeout = 30
      f.options.open_timeout = 5
    end
  end

  def plan(ir_payload)
    response = @conn.post("/jobs/plan", ir_payload)
    { success: response.success?, data: response.body }
  rescue Faraday::Error => e
    { success: false, error: e.message }
  end

  def deploy(ir_payload)
    response = @conn.post("/jobs/deploy", ir_payload)
    { success: response.success?, data: response.body }
  rescue Faraday::Error => e
    { success: false, error: e.message }
  end

  def scan(payload)
    response = @conn.post("/scan", payload)
    { success: response.success?, data: response.body }
  rescue Faraday::Error => e
    { success: false, error: e.message }
  end

  def registry_versions(namespace:, name:, provider:)
    response = @conn.post("/registry/versions", { namespace: namespace, name: name, provider: provider })
    { success: response.success?, data: response.body }
  rescue Faraday::Error => e
    { success: false, error: e.message }
  end

  def registry_download(namespace:, name:, provider:, version:)
    response = @conn.post("/registry/download", { namespace: namespace, name: name, provider: provider, version: version })
    { success: response.success?, data: response.body }
  rescue Faraday::Error => e
    { success: false, error: e.message }
  end

  def health
    response = @conn.get("/health")
    response.success?
  rescue Faraday::Error
    false
  end
end
