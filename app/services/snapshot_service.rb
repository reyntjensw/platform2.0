# frozen_string_literal: true

class SnapshotService
  def initialize(environment)
    @environment = environment
  end

  # Captures current state, assigns next semver, returns EnvironmentSnapshot
  def capture!(user_uuid:, version_bump: :patch)
    version = next_version(version_bump)
    resources = @environment.resources.includes(:module_definition, :application_group)
    snapshot_data = serialize_snapshot(resources)
    resource_count = resources.size
    metadata = build_metadata(user_uuid, resources)

    snapshot = @environment.environment_snapshots.create!(
      version: version,
      snapshot_data: snapshot_data,
      resource_count: resource_count,
      metadata: metadata
    )

    @environment.update!(current_version: version)

    snapshot
  end

  # Returns the latest EnvironmentSnapshot for the environment
  def latest_snapshot
    @environment.environment_snapshots.latest.first
  end

  # Computes next version based on bump type (:major, :minor, :patch)
  def next_version(bump_type = :patch)
    current = latest_snapshot&.version
    return "1.0.0" if current.blank?

    parts = current.split(".").map(&:to_i)
    major, minor, patch = parts[0] || 0, parts[1] || 0, parts[2] || 0

    case bump_type.to_sym
    when :major
      "#{major + 1}.0.0"
    when :minor
      "#{major}.#{minor + 1}.0"
    when :patch
      "#{major}.#{minor}.#{patch + 1}"
    else
      "#{major}.#{minor}.#{patch + 1}"
    end
  end

  private

  def serialize_snapshot(resources)
    connection_ids = resources.flat_map { |r| [r.id] }
    connections = Connection.where(from_resource_id: connection_ids, to_resource_id: connection_ids)

    resource_name_map = resources.index_by(&:id)

    {
      "resources" => resources.map { |r| serialize_resource(r) },
      "connections" => connections.map { |c| serialize_connection(c, resource_name_map) }
    }
  end

  def serialize_resource(resource)
    {
      "resource_id" => resource.id,
      "name" => resource.name,
      "module_definition_id" => resource.module_definition_id,
      "module_name" => resource.module_definition.name,
      "module_display_name" => resource.module_definition.display_name,
      "category" => resource.module_definition.category,
      "config" => resource.config,
      "zone" => resource.zone,
      "application_group_id" => resource.application_group_id,
      "application_group_name" => resource.application_group&.name
    }
  end

  def serialize_connection(connection, resource_map)
    {
      "from_resource_name" => resource_map[connection.from_resource_id]&.name,
      "to_resource_name" => resource_map[connection.to_resource_id]&.name,
      "connection_type" => connection.connection_type
    }
  end

  def build_metadata(user_uuid, resources)
    category_summary = resources.group_by { |r| r.module_definition.category }
                                .transform_values(&:size)

    {
      "user_uuid" => user_uuid,
      "timestamp" => Time.current.iso8601,
      "category_summary" => category_summary,
      "global_tags" => GlobalTag.to_tag_hash
    }
  end
end
