# frozen_string_literal: true

class DocumentationApiClient < ApiClient::Base
  def initialize
    @conn = self.class.connection(
      ENV.fetch("DOCUMENTATION_API_URL", "https://cloud-docs.be.dev.platform.cloudsisters.be"),
      timeout: 60,
      headers: platform_auth_headers
    )
  end

  # Start async documentation generation (Azure)
  def generate(customer_uuid:, project_uuid:, subscription_id:, provider: "azure", options: {})
    post("/generate", {
      customer_uuid: customer_uuid,
      project_uuid: project_uuid,
      provider: provider,
      subscription_id: subscription_id,
      options: {
        output_format: options[:output_format] || "png",
        layout: options[:layout] || "by_resource_group",
        include_relationships: options.fetch(:include_relationships, true),
        dry_run: options.fetch(:dry_run, false)
      }
    })
  end

  # Poll task status
  def status(task_id)
    get("/status/#{task_id}")
  end

  # Download diagram file
  def download_diagram(task_id)
    get("/diagram/#{task_id}")
  end

  # Download PDF file
  def download_pdf(task_id)
    get("/pdf/#{task_id}")
  end

  private

  attr_reader :conn

  def platform_auth_headers
    key = ENV.fetch("CS_PLATFORM_API_KEY", "")
    { "cs-intelligent-platform-header" => key }
  end
end
