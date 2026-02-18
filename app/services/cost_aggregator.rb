# frozen_string_literal: true

class CostAggregator
  # Aggregates cost estimates from all deployment layers into a single
  # deployment-level cost summary. Each layer's cost_estimate is expected
  # to follow the Infracost JSON output format with totalMonthlyCost and
  # totalHourlyCost as string-encoded decimals.
  #
  # @param deployment [Deployment]
  # @return [Hash] aggregated cost estimate
  def self.aggregate(deployment)
    layers = deployment.deployment_layers.ordered

    layer_costs = layers.filter_map do |layer|
      next if layer.cost_estimate.blank?

      {
        layer_index: layer.index,
        total_monthly_cost: layer.cost_estimate["totalMonthlyCost"].to_f,
        total_hourly_cost: layer.cost_estimate["totalHourlyCost"].to_f,
        currency: layer.cost_estimate["currency"] || "USD"
      }
    end

    total_monthly = layer_costs.sum { |lc| lc[:total_monthly_cost] }
    total_hourly = layer_costs.sum { |lc| lc[:total_hourly_cost] }
    currency = layer_costs.first&.dig(:currency) || "USD"

    {
      "totalMonthlyCost" => format("%.2f", total_monthly),
      "totalHourlyCost" => format("%.6f", total_hourly),
      "currency" => currency,
      "layers" => layer_costs.map do |lc|
        {
          "layer_index" => lc[:layer_index],
          "totalMonthlyCost" => format("%.2f", lc[:total_monthly_cost]),
          "totalHourlyCost" => format("%.6f", lc[:total_hourly_cost])
        }
      end
    }
  end
end
