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

  # Providers that require a cluster to be deployed first
  CLUSTER_DEPENDENT_PROVIDERS = %w[kubernetes helm kubectl].freeze

  # Cluster outputs referenced by dependent layers
  CLUSTER_OUTPUTS = %w[cluster_endpoint cluster_ca_certificate cluster_name].freeze

  # @param environment [LocalEnvironment]
  def initialize(environment)
    @env = environment
  end

  # Partitions resources into ordered deployment layers based on
  # Connection dependencies and provider requirements.
  #
  # @return [Array<DeploymentLayerStruct>] ordered layers
  # @raise [CircularDependencyError] if cycle detected
  def partition
    resources = @env.resources.includes(:module_definition).to_a
    return [] if resources.empty?

    graph = build_dependency_graph(resources)
    sorted_ids = topological_sort(resources, graph)
    layer_assignments = assign_layers(sorted_ids, graph)
    layer_assignments = resolve_provider_layers(resources, layer_assignments)
    build_layer_structs(resources, layer_assignments)
  end

  private

  # Build adjacency list from Connection model (type: "dependency").
  # Returns { resource_id => Set<dependency_resource_id> }
  def build_dependency_graph(resources)
    resource_ids = resources.map(&:id)
    graph = resource_ids.each_with_object({}) { |id, h| h[id] = Set.new }

    Connection.where(connection_type: "dependency")
              .where(from_resource_id: resource_ids, to_resource_id: resource_ids)
              .find_each do |conn|
      # from_resource depends on to_resource
      graph[conn.from_resource_id].add(conn.to_resource_id)
    end

    graph
  end

  # Kahn's algorithm — returns topologically sorted resource IDs or raises on cycle.
  def topological_sort(resources, graph)
    in_degree = graph.transform_values { 0 }
    graph.each do |_node, deps|
      deps.each { |dep| in_degree[dep] = (in_degree[dep] || 0) + 1 }
    end

    # Start with nodes that have no incoming edges (nothing depends on them
    # from within this set — but they themselves have no dependencies)
    queue = graph.keys.select { |id| graph[id].empty? }
    sorted = []

    until queue.empty?
      node = queue.shift
      sorted << node

      # Find nodes that depend on this node and decrement their effective in-degree
      graph.each do |candidate, deps|
        next unless deps.include?(node)

        in_degree[candidate] -= 1
        queue << candidate if in_degree[candidate] == 0
      end
    end

    if sorted.size != graph.size
      remaining = graph.keys - sorted
      raise CircularDependencyError,
            "Circular dependency detected among resources: #{remaining.join(', ')}"
    end

    sorted
  end

  # Assign each resource to the earliest layer where all its dependencies
  # are in prior layers. Resources with no deps go to layer 0.
  def assign_layers(sorted_ids, graph)
    layer_map = {} # resource_id => layer_index

    sorted_ids.each do |id|
      deps = graph[id]
      if deps.empty?
        layer_map[id] = 0
      else
        max_dep_layer = deps.map { |dep_id| layer_map[dep_id] || 0 }.max
        layer_map[id] = max_dep_layer + 1
      end
    end

    layer_map
  end

  # Resources requiring kubernetes/helm/kubectl providers must be in a layer
  # after the layer containing the cluster-producing resource they depend on.
  def resolve_provider_layers(resources, layer_map)
    resource_by_id = resources.index_by(&:id)

    # Find cluster-producing resources (resources whose dependents need k8s providers)
    cluster_layer = nil
    resources.each do |r|
      provider_deps = r.module_definition.provider_dependencies || []
      needs_cluster_provider = provider_deps.any? { |p| CLUSTER_DEPENDENT_PROVIDERS.include?(p) }
      next if needs_cluster_provider

      # A resource that doesn't need cluster providers but has dependents that do
      # is potentially a cluster producer. We identify cluster producers by checking
      # if any resource that depends on them needs cluster providers.
      next unless cluster_layer.nil? || layer_map[r.id] < cluster_layer

      has_cluster_dependent = resources.any? do |other|
        other_deps = other.module_definition.provider_dependencies || []
        other_deps.any? { |p| CLUSTER_DEPENDENT_PROVIDERS.include?(p) } &&
          resource_depends_on?(other.id, r.id, layer_map, resource_by_id)
      end

      cluster_layer = layer_map[r.id] if has_cluster_dependent
    end

    return layer_map if cluster_layer.nil?

    # Bump any resource needing cluster-dependent providers to at least cluster_layer + 1
    resources.each do |r|
      provider_deps = r.module_definition.provider_dependencies || []
      needs_cluster = provider_deps.any? { |p| CLUSTER_DEPENDENT_PROVIDERS.include?(p) }
      next unless needs_cluster

      min_layer = cluster_layer + 1
      layer_map[r.id] = [layer_map[r.id], min_layer].max
    end

    layer_map
  end

  def resource_depends_on?(resource_id, dependency_id, layer_map, resource_by_id)
    # Check if resource has a direct or indirect dependency on dependency_id
    # For simplicity, check direct connections
    Connection.exists?(
      from_resource_id: resource_id,
      to_resource_id: dependency_id,
      connection_type: "dependency"
    )
  end

  def build_layer_structs(resources, layer_map)
    resource_by_id = resources.index_by(&:id)
    account_id = @env.aws_account_id || @env.azure_subscription_id || @env.gcp_project_id

    # Group resources by layer
    grouped = layer_map.group_by { |_id, layer| layer }
                       .sort_by(&:first)

    grouped.map do |index, id_layer_pairs|
      layer_resources = id_layer_pairs.map { |id, _| resource_by_id[id] }
      providers = collect_providers(layer_resources)
      remote_refs = build_remote_state_refs(index, layer_resources, layer_map, resource_by_id)
      state_key = "#{@env.cloud_provider}/#{account_id}/#{@env.env_type}/layer_#{index}.tfstate"

      DeploymentLayerStruct.new(
        index: index,
        resources: layer_resources,
        required_providers: providers,
        remote_state_refs: remote_refs,
        state_key: state_key
      )
    end
  end

  # Collect unique providers needed by all resources in a layer
  def collect_providers(layer_resources)
    providers = Set.new
    # Always include the cloud provider
    providers.add(@env.cloud_provider)

    layer_resources.each do |r|
      (r.module_definition.provider_dependencies || []).each { |p| providers.add(p) }
    end

    providers.to_a.sort
  end

  # Build remote_state_refs for layers that depend on outputs from previous layers
  def build_remote_state_refs(current_index, _layer_resources, layer_map, resource_by_id)
    return [] if current_index == 0

    refs = {}
    _layer_resources.each do |r|
      provider_deps = r.module_definition.provider_dependencies || []
      needs_cluster = provider_deps.any? { |p| CLUSTER_DEPENDENT_PROVIDERS.include?(p) }

      if needs_cluster
        # Find which previous layer has the cluster
        layer_map.each do |dep_id, dep_layer|
          next if dep_layer >= current_index

          dep_resource = resource_by_id[dep_id]
          next unless dep_resource

          dep_providers = dep_resource.module_definition.provider_dependencies || []
          is_cluster_producer = !dep_providers.any? { |p| CLUSTER_DEPENDENT_PROVIDERS.include?(p) }

          if is_cluster_producer && Connection.exists?(
            from_resource_id: r.id,
            to_resource_id: dep_id,
            connection_type: "dependency"
          )
            account_id = @env.aws_account_id || @env.azure_subscription_id || @env.gcp_project_id
            refs[dep_layer] ||= {
              layer_index: dep_layer,
              state_key: "#{@env.cloud_provider}/#{account_id}/#{@env.env_type}/layer_#{dep_layer}.tfstate",
              outputs: []
            }
            CLUSTER_OUTPUTS.each { |o| refs[dep_layer][:outputs] << o unless refs[dep_layer][:outputs].include?(o) }
          end
        end
      end
    end

    refs.values
  end
end
