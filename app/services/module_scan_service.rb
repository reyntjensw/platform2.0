# frozen_string_literal: true

class ModuleScanService
  # Calls the Python pipeline /scan endpoint and returns parsed results.
  def initialize(pipeline_client: PipelineClient.new)
    @client = pipeline_client
  end

  def scan(source_url:, source_ref:, source_subpath: nil, engine: "opentofu", git_token: nil, use_ssh: false)
    payload = {
      source_url: source_url,
      source_ref: source_ref,
      source_subpath: source_subpath,
      engine: engine,
      git_token: git_token,
      use_ssh: use_ssh
    }.compact

    response = @client.scan(payload)

    if response[:success]
      { success: true, data: response[:data] }
    else
      { success: false, error: response[:error] || "Scan request failed" }
    end
  end
end
