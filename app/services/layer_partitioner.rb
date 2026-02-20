# frozen_string_literal: true

# Value object representing a single deployment layer
DeploymentLayerStruct = Struct.new(
  :index,              # Integer: 0, 1, 2...
  :resources,          # Array<Resource>
  :required_providers, # Array<String>: ["aws", "kubernetes", "helm"]
  :remote_state_refs,  # Array<Hash>: [{layer_index: 0, outputs: [...]}]
  :state_key,          # String: "aws/123456/dev/layer_0.tfstate"
  keyword_init: true
)

class LayerPartitioner
  class CircularDependencyError < StandardError; end

  # Providers that require a cluster to be deployed first.
  # Resources needing these providers MUST be in a later layer than
  # the cluster-producing resource they depend on.
  CLUSTER_DEPENDENT_PROVIDERS = %w[kubernetes helm kubectl].freeze

  # Cluster outputs referenced by dependent layers via remote state
  CLUSTER_OUTPUTS = %w[cluster_endpoint cluster_ca_certificate cluster_name].freeze

  # @param environment [LocalEnvironment]
  def initialize(environment)
    @env = environment
  end

  # Partitions resources into ordered deployment layers.
  #
  # Strategy: put everything in a single layer UNLESS a resource requires
  # a provider that depends on another resource being fully deployed first
  # (e.g., kubernetes/helm providers need an EKS cluster to exist).
  #
  # Same-provider dependencies (VPC → Subnet → SG → EC2) all go in one
  # layer — Terraform handles the internal ordering via module references.
  #
  # @return [Array<DeploymentLayerStruct>] ordered layers
  def partition
    resources = @env.resources.includes(:module_definition).to_a
    return [] if resources.empty?

    validate_no_cycles(resources)
    assign_provider_layers(resources)
  end

  private

  # Validates there are no circular dependencies among resources.
  # Only checks for actual cycles, not linear dependency chains.
  def validate_no_cycles(resources)
    resource_ids = resources.map(&:id).to_set
    graph = resource_ids.each_with_object({}) { |id, h| h[id] = Set.new }

    Connection.where(connection_type: "dependency")
              .where(from_resource_id: resource_ids, to_resource_id: resource_ids)
              .find_each do |conn|
      graph[conn.from_resource_id].add(conn.to_resource_id)
    end

    # Kahn's algorithm to detect cycles
    in_degree = {}
    graph.each do |node, deps|
      in_degree[node] ||= 0
      in_degree[node] += deps.size
    end

    queue = graph.keys.select { |id| in_degree[id] == 0 }
    visited = 0

    until queue.empty?
      node = queue.shift
      visited += 1
      graph.each do |candidate, deps|
        next unless deps.include?(node)
        in_degree[candidate] -= 1
        queue << candidate if in_degree[candidate] == 0
      end
    end

    if visited != graph.size
      remaining = graph.keys.select { |id| in_degree[id] > 0 }
      raise CircularDependencyError,
            "Circular dependency detected among resources: #{remaining.join(', ')}"
    end
  end

  # Assigns resources to layers based on provider boundaries only.
  #
  # Layer 0: all resources that DON'T need cluster-dependent providers
  # Layer 1: resources that need kubernetes/helm/kubectl providers
  #
  # Within each layer, Terraform handles dependency ordering via
  # module.xxx references — no need for separate layers.
  def assign_provider_layers(resources)
    # Separate resources into those needing cluster providers and those that don't
    base_resources = []
    cluster_dependent_resources = []

    resources.each do |r|
      provider_deps = r.module_definition.provider_dependencies || []
      needs_cluster = provider_deps.any? { |p| CLUSTER_DEPENDENT_PROVIDERS.include?(p) }

      if needs_cluster
        cluster_dependent_resources << r
      else
        base_resources << r
      end
    end

    # If no cluster-dependent resources, everything goes in one layer
    if cluster_dependent_resources.empty?
      return [build_layer_struct(0, base_resources)]
    end

    # If no base resources (unlikely but possible), cluster deps go in layer 0
    if base_resources.empty?
      return [build_layer_struct(0, cluster_dependent_resources)]
    end

    # Two layers: base infra first, then cluster-dependent resources
    layers = [build_layer_struct(0, base_resources)]

    # Build remote state refs so layer 1 can read cluster outputs from layer 0
    remote_refs = build_cross_layer_refs(0, base_resources, cluster_dependent_resources)
    layers << build_layer_struct(1, cluster_dependent_resources, remote_state_refs: remote_refs)

    layers
  end

  def build_layer_struct(index, resources, remote_state_refs: [])
    account_id = @env.aws_account_id || @env.azure_subscription_id || @env.gcp_project_id
    providers = collect_providers(resources)
    state_key = "#{@env.cloud_provider}/#{account_id}/#{@env.env_type}/layer_#{index}.tfstate"

    DeploymentLayerStruct.new(
      index: index,
      resources: resources,
      required_providers: providers,
      remote_state_refs: remote_state_refs,
      state_key: state_key
    )
  end

  # Build remote_state_refs for cluster-dependent resources that need
  # outputs from the base layer (e.g., cluster endpoint, CA cert).
  def build_cross_layer_refs(base_layer_index, base_resources, dependent_resources)
    account_id = @env.aws_account_id || @env.azure_subscription_id || @env.gcp_project_id
    base_state_key = "#{@env.cloud_provider}/#{account_id}/#{@env.env_type}/layer_#{base_layer_index}.tfstate"

    # Check if any dependent resource actually connects to a base resource
    base_ids = base_resources.map(&:id).to_set
    dep_ids = dependent_resources.map(&:id)

    has_cross_ref = Connection.where(
      connection_type: "dependency",
      from_resource_id: dep_ids,
      to_resource_id: base_ids.to_a
    ).exists?

    return [] unless has_cross_ref

    [{
      layer_index: base_layer_index,
      state_key: base_state_key,
      outputs: CLUSTER_OUTPUTS
    }]
  end

  # Collect unique providers needed by all resources in a layer
  def collect_providers(layer_resources)
    providers = Set.new
    providers.add(@env.cloud_provider)

    layer_resources.each do |r|
      (r.module_definition.provider_dependencies || []).each { |p| providers.add(p) }
    end

    providers.to_a.sort
  end
end
