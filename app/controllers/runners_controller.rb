# frozen_string_literal: true

class RunnersController < AuthenticatedController
  # GET /runners
  # Admin view: lists all registered runners with version, status,
  # and last heartbeat. Highlights outdated runners.
  def index
    service = RunnerStatusService.new(account_id: params[:account_id])
    @runners = service.list_runners
    @manifest = service.fetch_manifest
    @current_version = @manifest&.dig("current_version")
    @min_compatible_version = @manifest&.dig("min_compatible_version")
  end
end
