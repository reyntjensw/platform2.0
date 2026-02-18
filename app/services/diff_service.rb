# frozen_string_literal: true

class DiffService
  # Compares two EnvironmentSnapshots, optionally filtered by app group
  # Returns a DiffReport hash with added, modified, removed arrays and summary counts
  def initialize(source_snapshot, target_snapshot, app_group_id: nil)
    @source_snapshot = source_snapshot
    @target_snapshot = target_snapshot
    @app_group_id = app_group_id
  end

  def compute
    source_resources = extract_resources(@source_snapshot)
    target_resources = extract_resources(@target_snapshot)

    if @app_group_id.present?
      source_resources = source_resources.select { |r| r["application_group_id"] == @app_group_id }
      target_resources = target_resources.select { |r| r["application_group_id"] == @app_group_id }
    end

    source_index = index_by_key(source_resources)
    target_index = index_by_key(target_resources)

    added = compute_added(source_index, target_index)
    removed = compute_removed(source_index, target_index)
    modified = compute_modified(source_index, target_index)

    {
      added: added,
      modified: modified,
      removed: removed,
      summary: {
        added: added.size,
        modified: modified.size,
        removed: removed.size
      }
    }
  end

  private

  def extract_resources(snapshot)
    return [] if snapshot.nil?
    snapshot.snapshot_data&.dig("resources") || []
  end

  # Build a lookup key from module_definition_id + name
  def resource_key(resource)
    "#{resource['module_definition_id']}::#{resource['name']}"
  end

  def index_by_key(resources)
    resources.each_with_object({}) { |r, h| h[resource_key(r)] = r }
  end

  # Resources in source but not in target
  def compute_added(source_index, target_index)
    (source_index.keys - target_index.keys).map do |key|
      r = source_index[key]
      {
        resource_name: r["name"],
        resource_id: r["resource_id"],
        module_definition_id: r["module_definition_id"],
        module_name: r["module_name"],
        category: r["category"],
        config: r["config"],
        zone: r["zone"],
        application_group_id: r["application_group_id"],
        application_group_name: r["application_group_name"]
      }
    end
  end

  # Resources in target but not in source
  def compute_removed(source_index, target_index)
    (target_index.keys - source_index.keys).map do |key|
      r = target_index[key]
      {
        resource_name: r["name"],
        resource_id: r["resource_id"],
        module_definition_id: r["module_definition_id"],
        module_name: r["module_name"],
        category: r["category"],
        application_group_id: r["application_group_id"],
        application_group_name: r["application_group_name"]
      }
    end
  end

  # Resources in both but with differing config, zone, or connections
  def compute_modified(source_index, target_index)
    common_keys = source_index.keys & target_index.keys
    modified = []

    common_keys.each do |key|
      source_r = source_index[key]
      target_r = target_index[key]
      changes = compute_field_changes(source_r, target_r)
      next if changes.empty?

      modified << {
        resource_name: source_r["name"],
        resource_id: source_r["resource_id"],
        module_definition_id: source_r["module_definition_id"],
        module_name: source_r["module_name"],
        category: source_r["category"],
        changes: changes,
        application_group_id: source_r["application_group_id"],
        application_group_name: source_r["application_group_name"]
      }
    end

    modified
  end

  # Compute per-field changes with change origin tagging
  def compute_field_changes(source_r, target_r)
    changes = {}

    # Compare zone
    if source_r["zone"] != target_r["zone"]
      changes["zone"] = { from: target_r["zone"], to: source_r["zone"], origin: "source" }
    end

    # Compare config fields
    source_config = source_r["config"] || {}
    target_config = target_r["config"] || {}
    all_config_keys = (source_config.keys + target_config.keys).uniq

    module_def = find_module_definition(source_r["module_definition_id"])
    target_env_type = @target_snapshot&.local_environment&.env_type

    all_config_keys.each do |field_name|
      source_val = source_config[field_name]
      target_val = target_config[field_name]
      next if source_val == target_val

      origin = determine_change_origin(module_def, field_name, target_env_type, source_val)
      changes[field_name] = { from: target_val, to: source_val, origin: origin }
    end

    # Compare connections
    source_conns = connections_for_resource(source_r, @source_snapshot)
    target_conns = connections_for_resource(target_r, @target_snapshot)
    if source_conns != target_conns
      changes["connections"] = { from: target_conns, to: source_conns, origin: "source" }
    end

    changes
  end

  # Determine whether a field change originates from the source or from env overrides
  def determine_change_origin(module_def, field_name, target_env_type, source_val)
    return "source" unless module_def && target_env_type

    field = module_def.module_fields.find_by(name: field_name)
    return "source" unless field

    # If the field has a default for the target env and the source value differs from it
    env_default = field.defaults_by_env&.dig(target_env_type)
    if env_default.present? && source_val != env_default
      return "env_override"
    end

    # If the field is locked in the target env, changes are env overrides
    locked_envs = field.locked_in_envs || {}
    if locked_envs[target_env_type].present?
      return "env_override"
    end

    "source"
  end

  def find_module_definition(module_definition_id)
    return nil unless module_definition_id
    @module_definitions_cache ||= {}
    @module_definitions_cache[module_definition_id] ||=
      ModuleDefinition.includes(:module_fields).find_by(id: module_definition_id)
  end

  def connections_for_resource(resource, snapshot)
    return [] if snapshot.nil?
    all_connections = snapshot.snapshot_data&.dig("connections") || []
    name = resource["name"]
    all_connections.select { |c| c["from_resource_name"] == name || c["to_resource_name"] == name }
                   .sort_by { |c| [c["from_resource_name"], c["to_resource_name"]] }
  end
end
