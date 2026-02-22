# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_02_22_200001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  create_table "application_groups", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_environment_id", null: false
    t.string "name", null: false
    t.string "color", default: "#3b82f6", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["local_environment_id", "name"], name: "index_application_groups_on_local_environment_id_and_name", unique: true
    t.index ["local_environment_id"], name: "index_application_groups_on_local_environment_id"
  end

  create_table "audit_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_uuid", null: false
    t.uuid "reseller_uuid", null: false
    t.string "action", null: false
    t.string "resource_type", null: false
    t.uuid "resource_uuid"
    t.jsonb "change_data", default: {}
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_audit_logs_on_created_at"
    t.index ["reseller_uuid"], name: "index_audit_logs_on_reseller_uuid"
    t.index ["resource_type", "resource_uuid"], name: "index_audit_logs_on_resource_type_and_resource_uuid"
    t.index ["user_uuid"], name: "index_audit_logs_on_user_uuid"
  end

  create_table "business_rules", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "customer_id"
    t.string "name", null: false
    t.text "description"
    t.string "severity", default: "warn", null: false
    t.string "rule_type"
    t.string "scope_type", default: "platform", null: false
    t.jsonb "conditions", default: {}, null: false
    t.jsonb "actions", default: {}
    t.boolean "enabled", default: true, null: false
    t.string "cloud_provider", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "reseller_id"
    t.index ["cloud_provider"], name: "index_business_rules_on_cloud_provider"
    t.index ["customer_id"], name: "index_business_rules_on_customer_id"
    t.index ["enabled"], name: "index_business_rules_on_enabled"
    t.index ["name", "scope_type"], name: "index_business_rules_on_name_and_scope_type", unique: true
    t.index ["reseller_id"], name: "index_business_rules_on_reseller_id"
    t.index ["scope_type"], name: "index_business_rules_on_scope_type"
  end

  create_table "canvas_custom_codes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_environment_id", null: false
    t.text "code", default: "", null: false
    t.string "language", default: "hcl", null: false
    t.jsonb "validation_result", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["local_environment_id"], name: "index_canvas_custom_codes_on_local_environment_id", unique: true
  end

  create_table "canvas_locks", force: :cascade do |t|
    t.uuid "environment_id", null: false
    t.string "device_id", null: false
    t.string "user_email", null: false
    t.string "user_name"
    t.datetime "locked_at", null: false
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["environment_id"], name: "index_canvas_locks_on_environment_id", unique: true
  end

  create_table "connections", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "from_resource_id", null: false
    t.uuid "to_resource_id", null: false
    t.string "connection_type", default: "dependency", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["from_resource_id", "to_resource_id"], name: "index_connections_on_from_resource_id_and_to_resource_id", unique: true
    t.index ["from_resource_id"], name: "index_connections_on_from_resource_id"
    t.index ["to_resource_id"], name: "index_connections_on_to_resource_id"
  end

  create_table "dashboards", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_customer_id", null: false
    t.string "name", null: false
    t.text "description"
    t.boolean "is_default", default: false
    t.jsonb "layout_config", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["local_customer_id", "name"], name: "index_dashboards_on_local_customer_id_and_name", unique: true
    t.index ["local_customer_id"], name: "index_dashboards_on_local_customer_id"
  end

  create_table "deployment_layers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "deployment_id", null: false
    t.integer "index", null: false
    t.jsonb "resource_ids", default: [], null: false
    t.jsonb "required_providers", default: [], null: false
    t.jsonb "remote_state_refs", default: [], null: false
    t.string "state_key", null: false
    t.string "status", default: "pending", null: false
    t.uuid "job_id"
    t.text "plan_output"
    t.jsonb "cost_estimate", default: {}
    t.text "error_details"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "step_details", default: [], null: false
    t.index ["deployment_id", "index"], name: "index_deployment_layers_on_deployment_id_and_index", unique: true
    t.index ["deployment_id"], name: "index_deployment_layers_on_deployment_id"
    t.index ["job_id"], name: "index_deployment_layers_on_job_id"
    t.index ["status"], name: "index_deployment_layers_on_status"
  end

  create_table "deployments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_environment_id", null: false
    t.uuid "triggered_by_uuid", null: false
    t.string "status", default: "pending", null: false
    t.text "plan_output"
    t.jsonb "result", default: {}
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "total_layers", default: 1
    t.integer "current_layer", default: 0
    t.jsonb "cost_estimate", default: {}
    t.uuid "approved_by_uuid"
    t.datetime "approved_at"
    t.string "approval_status"
    t.integer "version", default: 1, null: false
    t.index ["approval_status"], name: "index_deployments_on_approval_status"
    t.index ["local_environment_id", "version"], name: "index_deployments_on_local_environment_id_and_version", unique: true
    t.index ["local_environment_id"], name: "index_deployments_on_local_environment_id"
    t.index ["status"], name: "index_deployments_on_status"
    t.index ["triggered_by_uuid"], name: "index_deployments_on_triggered_by_uuid"
  end

  create_table "environment_snapshots", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_environment_id", null: false
    t.string "version", null: false
    t.jsonb "snapshot_data", default: {}, null: false
    t.integer "resource_count", default: 0, null: false
    t.jsonb "metadata", default: {}
    t.datetime "created_at", null: false
    t.index ["created_at"], name: "index_environment_snapshots_on_created_at"
    t.index ["local_environment_id", "version"], name: "idx_on_local_environment_id_version_54cfa5cbd4", unique: true
    t.index ["local_environment_id"], name: "index_environment_snapshots_on_local_environment_id"
  end

  create_table "field_mappings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "module_renderer_id", null: false
    t.string "platform_field", null: false
    t.string "renderer_variable", null: false
    t.string "mapping_type", default: "direct", null: false
    t.string "transform"
    t.string "dependency_syntax"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["module_renderer_id", "platform_field"], name: "index_field_mappings_on_module_renderer_id_and_platform_field", unique: true
    t.index ["module_renderer_id"], name: "index_field_mappings_on_module_renderer_id"
  end

  create_table "git_credentials", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "owner_type", null: false
    t.uuid "owner_id", null: false
    t.string "name", null: false
    t.string "host", null: false
    t.string "credential_type", null: false
    t.text "token"
    t.text "ssh_private_key"
    t.string "scope", default: "read_repository"
    t.boolean "active", default: true
    t.datetime "last_verified_at"
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["owner_type", "owner_id"], name: "index_git_credentials_on_owner_type_and_owner_id"
  end

  create_table "global_tags", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "key", null: false
    t.string "value", null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "taggable_type"
    t.uuid "taggable_id"
    t.index ["enabled"], name: "index_global_tags_on_enabled"
    t.index ["key", "taggable_type", "taggable_id"], name: "index_global_tags_on_key_and_taggable", unique: true
    t.index ["key"], name: "index_global_tags_on_key_platform", unique: true, where: "((taggable_type IS NULL) AND (taggable_id IS NULL))"
    t.index ["taggable_type", "taggable_id"], name: "index_global_tags_on_taggable"
  end

  create_table "local_customers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_reseller_id", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.jsonb "config", default: {}
    t.string "keycloak_group_path"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "flagged_for_deletion_at"
    t.index ["local_reseller_id"], name: "index_local_customers_on_local_reseller_id"
    t.index ["slug"], name: "index_local_customers_on_slug"
  end

  create_table "local_environments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_project_id", null: false
    t.string "name", null: false
    t.string "env_type", null: false
    t.string "cloud_provider", null: false
    t.string "iac_engine", default: "opentofu", null: false
    t.string "aws_account_id"
    t.string "aws_role_arn"
    t.string "azure_subscription_id"
    t.jsonb "config", default: {}
    t.string "deploy_status"
    t.datetime "last_deployed_at"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "upgrade_policy", default: "manual"
    t.string "current_version", default: "0.0.0"
    t.string "gcp_project_id"
    t.string "execution_mode", default: "platform", null: false
    t.datetime "flagged_for_deletion_at"
    t.index ["cloud_provider"], name: "index_local_environments_on_cloud_provider"
    t.index ["env_type"], name: "index_local_environments_on_env_type"
    t.index ["local_project_id"], name: "index_local_environments_on_local_project_id"
  end

  create_table "local_projects", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_customer_id", null: false
    t.string "name", null: false
    t.string "slug", null: false
    t.string "cloud_provider", null: false
    t.string "default_region"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "flagged_for_deletion_at"
    t.index ["cloud_provider"], name: "index_local_projects_on_cloud_provider"
    t.index ["local_customer_id"], name: "index_local_projects_on_local_customer_id"
    t.index ["slug"], name: "index_local_projects_on_slug"
  end

  create_table "local_resellers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.jsonb "config", default: {}
    t.string "keycloak_group_path"
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "flagged_for_deletion_at"
    t.index ["slug"], name: "index_local_resellers_on_slug", unique: true
  end

  create_table "module_definitions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "owner_type"
    t.uuid "owner_id"
    t.string "name", null: false
    t.string "display_name", null: false
    t.text "description"
    t.string "version", default: "1.0.0"
    t.string "status", default: "draft", null: false
    t.string "cloud_provider", null: false
    t.string "category", null: false
    t.string "icon"
    t.string "ownership", default: "platform", null: false
    t.string "visibility", default: "global", null: false
    t.jsonb "constraints", default: {}
    t.jsonb "supported_engines", default: []
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "allowed_zones", default: ["public", "private"], null: false
    t.jsonb "provider_dependencies", default: [], null: false
    t.index ["category"], name: "index_module_definitions_on_category"
    t.index ["cloud_provider"], name: "index_module_definitions_on_cloud_provider"
    t.index ["name", "cloud_provider"], name: "index_module_definitions_on_name_and_cloud_provider", unique: true
    t.index ["owner_type", "owner_id"], name: "index_module_definitions_on_owner_type_and_owner_id"
    t.index ["status"], name: "index_module_definitions_on_status"
    t.index ["visibility"], name: "index_module_definitions_on_visibility"
  end

  create_table "module_fields", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "module_definition_id", null: false
    t.string "name", null: false
    t.string "label", null: false
    t.string "field_type", default: "string", null: false
    t.string "classification", default: "user_config", null: false
    t.boolean "required", default: false
    t.jsonb "default_value"
    t.jsonb "defaults_by_env"
    t.jsonb "validation", default: {}
    t.string "group"
    t.integer "position", default: 0
    t.jsonb "locked_in_envs", default: {}
    t.jsonb "dependency_config"
    t.string "platform_source"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "data_source"
    t.index ["classification"], name: "index_module_fields_on_classification"
    t.index ["module_definition_id", "name"], name: "index_module_fields_on_module_definition_id_and_name", unique: true
    t.index ["module_definition_id"], name: "index_module_fields_on_module_definition_id"
  end

  create_table "module_import_drafts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "owner_type"
    t.uuid "owner_id"
    t.string "user_uuid", null: false
    t.integer "current_step", default: 1
    t.string "import_method", default: "git_url"
    t.string "source_url"
    t.string "source_ref"
    t.string "source_subpath"
    t.string "engine", default: "opentofu"
    t.string "cloud_provider"
    t.uuid "git_credential_id"
    t.jsonb "scan_result", default: {}
    t.jsonb "classifications", default: {}
    t.jsonb "field_configs", default: {}
    t.jsonb "metadata", default: {}
    t.string "status", default: "in_progress"
    t.string "registry_namespace"
    t.string "registry_name"
    t.string "registry_provider"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["git_credential_id"], name: "index_module_import_drafts_on_git_credential_id"
    t.index ["owner_type", "owner_id"], name: "index_module_import_drafts_on_owner_type_and_owner_id"
    t.index ["status"], name: "index_module_import_drafts_on_status"
    t.index ["user_uuid"], name: "index_module_import_drafts_on_user_uuid"
  end

  create_table "module_outputs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "module_definition_id", null: false
    t.string "name", null: false
    t.string "description"
    t.string "output_type", default: "string"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["module_definition_id", "name"], name: "index_module_outputs_on_module_definition_id_and_name", unique: true
    t.index ["module_definition_id"], name: "index_module_outputs_on_module_definition_id"
  end

  create_table "module_renderers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "module_definition_id", null: false
    t.uuid "git_credential_id"
    t.string "engine", default: "opentofu", null: false
    t.string "source_type", null: false
    t.string "source_url", null: false
    t.string "source_ref"
    t.string "source_subpath"
    t.jsonb "discovered_vars", default: {}
    t.jsonb "discovered_outputs", default: {}
    t.datetime "last_scanned_at"
    t.string "scan_status", default: "pending"
    t.text "scan_error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["git_credential_id"], name: "index_module_renderers_on_git_credential_id"
    t.index ["module_definition_id", "engine"], name: "index_module_renderers_on_module_definition_id_and_engine", unique: true
    t.index ["module_definition_id"], name: "index_module_renderers_on_module_definition_id"
  end

  create_table "module_versions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "module_renderer_id", null: false
    t.string "version_ref", null: false
    t.jsonb "discovered_vars", default: {}
    t.jsonb "discovered_outputs", default: {}
    t.boolean "breaking", default: false
    t.text "changelog"
    t.jsonb "compatibility_report", default: {}
    t.datetime "scanned_at"
    t.datetime "published_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["module_renderer_id", "version_ref"], name: "index_module_versions_on_module_renderer_id_and_version_ref", unique: true
    t.index ["module_renderer_id"], name: "index_module_versions_on_module_renderer_id"
  end

  create_table "promotion_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "source_environment_id", null: false
    t.uuid "target_environment_id", null: false
    t.uuid "source_snapshot_id", null: false
    t.uuid "target_snapshot_id"
    t.uuid "user_uuid", null: false
    t.uuid "approver_uuid"
    t.string "status", default: "pending", null: false
    t.jsonb "diff_summary", default: {}
    t.jsonb "diff_detail", default: {}
    t.text "plan_output"
    t.jsonb "excluded_resource_ids", default: []
    t.uuid "app_group_id"
    t.text "rejection_reason"
    t.text "error_details"
    t.datetime "approved_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["app_group_id"], name: "index_promotion_records_on_app_group_id"
    t.index ["source_environment_id"], name: "index_promotion_records_on_source_environment_id"
    t.index ["source_snapshot_id"], name: "index_promotion_records_on_source_snapshot_id"
    t.index ["status"], name: "index_promotion_records_on_status"
    t.index ["target_environment_id"], name: "index_promotion_records_on_target_environment_id"
    t.index ["target_snapshot_id"], name: "index_promotion_records_on_target_snapshot_id"
    t.index ["user_uuid"], name: "index_promotion_records_on_user_uuid"
  end

  create_table "resources", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "local_environment_id", null: false
    t.uuid "module_definition_id", null: false
    t.string "name", null: false
    t.jsonb "config", default: {}
    t.string "zone", default: "private"
    t.jsonb "validation_errors", default: {}
    t.float "position_x", default: 100.0
    t.float "position_y", default: 100.0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "renderer_ref"
    t.boolean "upgrade_available", default: false
    t.jsonb "upgrade_report", default: {}
    t.uuid "application_group_id"
    t.index ["application_group_id"], name: "index_resources_on_application_group_id"
    t.index ["local_environment_id", "name"], name: "index_resources_on_local_environment_id_and_name", unique: true
    t.index ["local_environment_id"], name: "index_resources_on_local_environment_id"
    t.index ["module_definition_id"], name: "index_resources_on_module_definition_id"
  end

  create_table "widget_filters", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "widget_id", null: false
    t.string "filter_type", null: false
    t.string "filter_value", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["widget_id"], name: "index_widget_filters_on_widget_id"
  end

  create_table "widgets", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "dashboard_id", null: false
    t.string "chart_type", null: false
    t.string "title", null: false
    t.integer "position", default: 0
    t.boolean "is_saved", default: false
    t.boolean "is_expanded", default: false
    t.jsonb "query_config", default: {}
    t.jsonb "display_config", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["dashboard_id"], name: "index_widgets_on_dashboard_id"
  end

  add_foreign_key "application_groups", "local_environments"
  add_foreign_key "canvas_custom_codes", "local_environments"
  add_foreign_key "canvas_locks", "local_environments", column: "environment_id"
  add_foreign_key "connections", "resources", column: "from_resource_id", on_delete: :cascade
  add_foreign_key "connections", "resources", column: "to_resource_id", on_delete: :cascade
  add_foreign_key "dashboards", "local_customers"
  add_foreign_key "deployment_layers", "deployments", on_delete: :cascade
  add_foreign_key "deployments", "local_environments"
  add_foreign_key "environment_snapshots", "local_environments"
  add_foreign_key "field_mappings", "module_renderers"
  add_foreign_key "local_customers", "local_resellers"
  add_foreign_key "local_environments", "local_projects"
  add_foreign_key "local_projects", "local_customers"
  add_foreign_key "module_fields", "module_definitions"
  add_foreign_key "module_import_drafts", "git_credentials"
  add_foreign_key "module_outputs", "module_definitions"
  add_foreign_key "module_renderers", "git_credentials"
  add_foreign_key "module_renderers", "module_definitions"
  add_foreign_key "module_versions", "module_renderers"
  add_foreign_key "promotion_records", "environment_snapshots", column: "source_snapshot_id"
  add_foreign_key "promotion_records", "environment_snapshots", column: "target_snapshot_id"
  add_foreign_key "promotion_records", "local_environments", column: "source_environment_id"
  add_foreign_key "promotion_records", "local_environments", column: "target_environment_id"
  add_foreign_key "resources", "application_groups"
  add_foreign_key "resources", "local_environments"
  add_foreign_key "resources", "module_definitions"
  add_foreign_key "widget_filters", "widgets"
  add_foreign_key "widgets", "dashboards"
end
