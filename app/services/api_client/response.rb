# frozen_string_literal: true

module ApiClient
  class Response
    attr_reader :status, :body, :error

    def initialize(status:, body: nil, error: nil)
      @status = status
      @body = body
      @error = error
    end

    def success? = status.between?(200, 299)
    def data = body
    def not_found? = status == 404
    def server_error? = status >= 500

    def to_s
      success? ? "OK(#{status})" : "Error(#{status}: #{error || body})"
    end
  end
end
