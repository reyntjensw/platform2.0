# frozen_string_literal: true

module Api
  module Customer
    class DocumentationController < BaseController
      # POST /customers/:customer_uuid/api/documentation/generate
      # Starts async Azure documentation generation
      def generate
        result = doc_client.generate(
          customer_uuid: customer_uuid,
          project_uuid: params[:project_uuid],
          subscription_id: params[:subscription_id],
          provider: params[:provider] || "azure",
          options: {
            output_format: params.dig(:options, :output_format) || "png",
            layout: params.dig(:options, :layout) || "by_resource_group",
            include_relationships: params.dig(:options, :include_relationships) != false
          }
        )

        if result.status == 200 || result.status == 201
          render json: result.body
        else
          render json: { error: result.body&.dig(:detail) || result.error || "Generation failed" },
                 status: result.status.zero? ? 502 : result.status
        end
      end

      # GET /customers/:customer_uuid/api/documentation/status/:task_id
      # Polls task status for Azure documentation
      def status
        result = doc_client.status(params[:task_id])

        if result.status == 200
          render json: result.body
        else
          render json: { error: result.body&.dig(:detail) || result.error || "Status check failed" },
                 status: result.status.zero? ? 502 : result.status
        end
      end

      # GET /customers/:customer_uuid/api/documentation/aws/:account_id
      # Proxies AWS documentation from platform API
      # Region is resolved from the project's default_region
      def aws_doc
        project = @local_customer.local_projects
                                 .joins(:local_environments)
                                 .where(local_environments: { aws_account_id: params[:account_id] })
                                 .first

        region = project&.default_region.presence || "eu-west-1"

        result = platform_client.aws_documentation(account_id: params[:account_id], region: region)

        if result.status == 200
          pdf_base64 = result.body.is_a?(String) ? result.body.gsub(/\A"|"\z/, '') : result.body
          render json: { pdf_base64: pdf_base64 }
        else
          render json: { error: result.body&.dig(:detail) || result.error || "Documentation fetch failed" },
                 status: result.status.zero? ? 502 : result.status
        end
      end

      private

      def doc_client
        @doc_client ||= DocumentationApiClient.new
      end

      def platform_client
        @platform_client ||= PlatformApiClient.new
      end

      def customer_uuid
        params[:customer_uuid]
      end
    end
  end
end
