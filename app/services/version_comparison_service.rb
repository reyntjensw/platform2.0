# frozen_string_literal: true

class VersionComparisonService
  # Compares two sets of discovered variables and generates a compatibility report.
  # Returns { breaking: bool, added: [...], removed: [...], changed: [...] }
  def self.compare(old_vars, new_vars)
    old_map = index_by_name(old_vars)
    new_map = index_by_name(new_vars)

    added = []
    removed = []
    changed = []
    breaking = false

    # Find added variables
    (new_map.keys - old_map.keys).each do |name|
      var = new_map[name]
      has_default = !var["default"].nil?
      is_breaking = !has_default && var.fetch("required", true)
      breaking = true if is_breaking
      added << { "name" => name, "type" => var["type"], "default" => var["default"],
                 "required" => !has_default, "breaking" => is_breaking }
    end

    # Find removed variables
    (old_map.keys - new_map.keys).each do |name|
      breaking = true
      removed << { "name" => name, "type" => old_map[name]["type"], "breaking" => true }
    end

    # Find changed variables
    (old_map.keys & new_map.keys).each do |name|
      old_var = old_map[name]
      new_var = new_map[name]
      changes = {}

      if normalize_type(old_var["type"]) != normalize_type(new_var["type"])
        changes["type"] = { "from" => old_var["type"], "to" => new_var["type"] }
        breaking = true
      end

      if old_var["default"] != new_var["default"]
        changes["default"] = { "from" => old_var["default"], "to" => new_var["default"] }
      end

      if old_var.fetch("required", false) != new_var.fetch("required", false)
        changes["required"] = { "from" => old_var["required"], "to" => new_var["required"] }
        breaking = true if new_var["required"]
      end

      changed << { "name" => name, "changes" => changes, "breaking" => changes.key?("type") || (changes.key?("required") && new_var["required"]) } if changes.any?
    end

    {
      "breaking" => breaking,
      "added" => added,
      "removed" => removed,
      "changed" => changed
    }
  end

  def self.index_by_name(vars)
    return {} unless vars.is_a?(Array)

    vars.each_with_object({}) { |v, h| h[v["name"]] = v if v.is_a?(Hash) && v["name"] }
  end

  def self.normalize_type(type)
    type.to_s.strip.downcase
  end

  private_class_method :index_by_name, :normalize_type
end
