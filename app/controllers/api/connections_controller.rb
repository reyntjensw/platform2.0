# frozen_string_literal: true

module Api
  class ConnectionsController < BaseController
    # POST /api/environments/:environment_id/connections
    def create
      from = @environment.resources.find(params[:from_resource_id])
      to = @environment.resources.find(params[:to_resource_id])

      connection = Connection.new(
        from_resource: from,
        to_resource: to,
        connection_type: params[:connection_type] || "dependency"
      )

      if connection.save
        render json: {
          id: connection.id,
          from_resource_id: connection.from_resource_id,
          to_resource_id: connection.to_resource_id,
          connection_type: connection.connection_type
        }, status: :created
      else
        render_error(connection.errors.full_messages.join(", "))
      end
    rescue ActiveRecord::RecordNotFound
      render_error("Resource not found", status: :not_found)
    end

    # DELETE /api/environments/:environment_id/connections/:id
    def destroy
      connection = Connection.find(params[:id])
      connection.destroy!
      head :no_content
    rescue ActiveRecord::RecordNotFound
      render_error("Connection not found", status: :not_found)
    end
  end
end
