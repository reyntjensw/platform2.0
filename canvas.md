# Slice 1: Foundation — Tenant Hierarchy, Module System, First Canvas, First Deploy

## Overview
Build on the existing Rails 8 application with Keycloak authentication already in place. Implement the tenant hierarchy (Reseller → Customer → Project → Environment), the module system with multi-cloud support and Bring Your Own Module (BYOM) capability, a minimal canvas for one module (VPC), and a Python pipeline service that generates OpenTofu code and runs `tofu plan`.

At the end of this slice, a user can: sign in (existing auth), navigate the tenant hierarchy, open an AWS environment, see AWS-only modules in the catalog, add a VPC to the canvas, configure it, and see a real Terraform plan.

## Prerequisites
- Existing Rails 8 application with Hotwire (Turbo + Stimulus)
- Existing Keycloak integration (authentication working, user roles available)
- PostgreSQL and Redis configured

## Architecture References
- Main: factorfifty-architecture.html (Sections 2-6, 8-9)
- Addendum: factorfifty-architecture-addendum-v2.html (Section A1 for GitLab credentials)

---

## Requirement 1: Factor Fifty Design System

### Description
Apply the Factor Fifty visual design system to the existing Rails app: dark theme, Outfit font, Cloudsisters branding. This becomes the foundation for all subsequent UI work.

### Acceptance Criteria
- [ ] CSS variables defined globally: --bg (#080b12), --bg2 (#0e1219), --bg3 (#151b28), --card (#131a26), --border (#1e2a3d), --green (#2ecc71), --t1 (#eef1f6), --t2 (#8494b2), --t3 (#4d5f7a)
- [ ] Outfit + JetBrains Mono fonts loaded from Google Fonts
- [ ] Application layout renders the F50 top bar: Cloudsisters logo (5 vertical green bars), breadcrumb placeholder, user avatar
- [ ] Shared UI components styled: buttons (green primary, ghost secondary), inputs, select, toggle switches, tags/badges, cards
- [ ] Dark theme applied globally — no white/light backgrounds anywhere
- [ ] Responsive: works on 1280px+ screens (primary target is desktop)

### Tasks
1. Add F50 CSS custom properties to application stylesheet
2. Import Outfit and JetBrains Mono from Google Fonts
3. Create application layout partial with F50 top bar and logo
4. Create shared component partials: _button, _input, _select, _toggle, _tag, _card
5. Style all existing views with dark theme
6. Add breadcrumb component (populated by controllers)

---

## Requirement 2: Tenant Hierarchy

### Description
Implement the multi-tenant data model: Reseller → Customer → Project → Environment. All data is scoped to the current user's tenant. Tenant context is derived from the existing Keycloak group claims.

### Acceptance Criteria
- [ ] Reseller model: name, slug, config (jsonb), keycloak_group_path
- [ ] Customer model: belongs_to reseller, name, slug, config (jsonb), keycloak_group_path
- [ ] Project model: belongs_to customer, name, slug, cloud_provider (aws|azure|gcp), default_region
- [ ] Environment model: belongs_to project, name, env_type (dev|acc|prd|shared), cloud_provider (inherited from project or overridden), iac_engine (opentofu — single option for Slice 1), region, aws_account_id, aws_role_arn, azure_subscription_id, config (jsonb), deploy_status, last_deployed_at
- [ ] Current tenant context via ActiveSupport::CurrentAttributes: Current.reseller, Current.customer, Current.project, Current.environment
- [ ] Tenant context set from Keycloak group claims in existing auth flow
- [ ] Default scoping: all model queries scoped to Current.reseller
- [ ] Pundit policies for each model: platform_admin sees all, reseller_admin sees own reseller, customer_admin sees own customer, etc.
- [ ] Navigation UI: sidebar or breadcrumb showing Reseller > Customer > Project > Environment
- [ ] Seeds: Cloudsisters reseller, Immovlan BV customer, Immovlan AWS project (cloud_provider: aws), three environments (dev, acc, prd)

### Tasks
1. Create Reseller migration and model with validations
2. Create Customer migration and model (belongs_to :reseller)
3. Create Project migration and model (belongs_to :customer, cloud_provider field)
4. Create Environment migration and model (belongs_to :project, cloud_provider, iac_engine)
5. Create Current class with tenant attributes
6. Create TenantScoping concern — sets Current from Keycloak group claims on each request
7. Create Pundit policies scoped to tenant hierarchy
8. Create seeds.rb with Cloudsisters / Immovlan / Immovlan AWS / dev+acc+prd
9. Create navigation: customer/project/environment selector and breadcrumb
10. Create index/show views for each hierarchy level with F50 styling

---

## Requirement 3: Module System — Core Models

### Description
Implement the module definition data model with support for multi-cloud (AWS vs Azure), module ownership levels (platform, reseller, customer BYOM), visibility scoping, and the renderer/field mapping architecture for IaC engine independence.

### Acceptance Criteria
- [ ] ModuleDefinition model with fields:
  - belongs_to :owner, polymorphic: true, optional: true (nil for platform modules)
  - name, display_name, description, version, status (draft|live|deprecated)
  - cloud_provider: "aws" | "azure" | "gcp" | "multi"
  - category: "compute" | "database" | "networking" | "storage" | "security" | "monitoring" | "other"
  - icon (string identifier for canvas rendering)
  - ownership: "platform" | "reseller" | "customer"
  - visibility: "global" | "reseller" | "customer"
  - constraints (jsonb): { subnet_type: "private_only", requires: ["vpc"] }
  - supported_engines (jsonb): derived from attached renderers
- [ ] ModuleField model with fields:
  - belongs_to :module_definition
  - name (internal key), label (UI display)
  - field_type: "string" | "integer" | "boolean" | "enum" | "list" | "object"
  - classification: "user_config" | "dependency" | "platform_managed"
  - required (boolean)
  - default_value (jsonb), defaults_by_env (jsonb): { dev: X, acc: Y, prd: Z }
  - validation (jsonb): { regex, min, max, enum: [...] }
  - group (string for UI grouping), position (integer)
  - locked_in_envs (jsonb): { prd: true }
  - dependency_config (jsonb): { source_module: "vpc", source_output: "vpc_id" }
  - platform_source (string): "env_name" | "resource_name" | "tags" | "account_id"
- [ ] ModuleOutput model: belongs_to :module_definition, name, description, output_type
- [ ] ModuleRenderer model:
  - belongs_to :module_definition
  - belongs_to :git_credential, optional: true
  - engine: "opentofu" (only option in Slice 1)
  - source_type: "git" | "registry" | "s3" | "npm" | "inline"
  - source_url, source_ref, source_subpath
  - discovered_vars (jsonb), discovered_outputs (jsonb)
  - last_scanned_at, scan_status (pending|scanning|ready|error), scan_error
  - unique constraint: [module_definition_id, engine]
- [ ] FieldMapping model:
  - belongs_to :module_renderer
  - platform_field, renderer_variable
  - mapping_type: "direct" | "transform" | "dependency_ref" | "platform_inject"
  - transform: "to_string" | "to_int" | "wrap_list" | "first_element" | "bool_to_string" | "json_encode" | nil
  - dependency_syntax (engine-specific reference template)
- [ ] GitCredential model:
  - belongs_to :owner, polymorphic: true (Reseller or Customer — for BYOM)
  - name, host, credential_type (project_token|group_token|deploy_token|ssh_key)
  - token (encrypted), ssh_private_key (encrypted, optional)
  - scope ("read_repository"), active, last_verified_at, expires_at
  - Rails 8 encryption on token and ssh_private_key
- [ ] Scoping:
  - ModuleDefinition.for_environment(env) → filters by cloud_provider + visibility
  - ModuleDefinition.visible_to(customer) → platform + reseller's + customer's own
  - Canvas catalog uses: ModuleDefinition.for_environment(env).where(status: "live")

### Tasks
1. Create ModuleDefinition migration and model with polymorphic owner
2. Create ModuleField migration and model with all classification types
3. Create ModuleOutput migration and model
4. Create ModuleRenderer migration and model with unique constraint on [module_definition_id, engine]
5. Create FieldMapping migration and model
6. Create GitCredential migration and model with Rails encryption
7. Implement ModuleDefinition.for_environment scope (cloud_provider + visibility filtering)
8. Implement ModuleDefinition.visible_to scope (platform + reseller + customer BYOM)
9. Write comprehensive model specs with factory_bot factories

---

## Requirement 4: Seed Platform Modules — AWS

### Description
Seed the first set of AWS platform modules. For Slice 1, only VPC needs a full renderer with field mappings. Other modules are seeded as definitions (status: "live") so they appear in the catalog for diagram purposes, but marked as "no renderer" so deploy is blocked until renderers are added in later slices.

### Acceptance Criteria
- [ ] VPC module fully operational (definition + fields + OpenTofu renderer + field mappings):
  - Fields: cidr_block (user_config, string, default "10.0.0.0/16"), enable_nat (user_config, boolean, default true), az_count (user_config, integer, min 1 max 3, default 3), tags (platform_managed), environment (platform_managed), name_prefix (platform_managed)
  - Outputs: vpc_id, public_subnet_ids, private_subnet_ids, nat_gateway_ids
  - Renderer: OpenTofu, source: git::https://gitlab.cloudsisters.io/modules/aws-vpc.git
  - Field mappings: 1:1 (cidr_block → cidr_block, etc.)
- [ ] Additional AWS modules seeded (definition + fields, NO renderer yet):
  - Compute: EKS Cluster, ECS Service, Lambda, ALB
  - Database: RDS PostgreSQL, ElastiCache (Redis), DynamoDB, OpenSearch
  - Networking: CloudFront, Route53 Hosted Zone
  - Storage: S3 Bucket, EFS
  - Security: IAM Role, KMS Key
- [ ] Each module has at least 3-6 user_config fields with correct types, defaults, and validations
- [ ] Modules without renderers show a "Canvas only — no deployment" indicator in the catalog
- [ ] All modules: ownership: "platform", visibility: "global", cloud_provider: "aws"
- [ ] Seed one Azure module as proof of multi-cloud (AKS, cloud_provider: "azure") — won't appear in AWS environments

### Tasks
1. Create comprehensive seed file for VPC module (definition, fields, outputs, renderer, mappings)
2. Create seed data for EKS module (definition + fields + outputs, no renderer — Slice 2 adds it)
3. Create seed data for remaining AWS compute modules (ECS, Lambda, ALB)
4. Create seed data for AWS database modules (RDS, ElastiCache, DynamoDB, OpenSearch)
5. Create seed data for AWS networking modules (CloudFront, Route53)
6. Create seed data for AWS storage modules (S3, EFS)
7. Create seed data for AWS security modules (IAM Role, KMS)
8. Create seed data for one Azure module (AKS) as multi-cloud proof
9. Add "Canvas only" indicator logic for modules without renderers
10. Verify all modules appear correctly when filtered by cloud_provider

---

## Requirement 5: Module Registry UI

### Description
A page showing all modules available to the current user, grouped by cloud provider and category. Shows module status, field count, supported engines, and ownership level.

### Acceptance Criteria
- [ ] Module Registry page accessible from main navigation
- [ ] Filter bar: cloud provider toggle (AWS / Azure / All), category filter, ownership filter (Platform / Reseller / My Modules)
- [ ] Module grid showing cards: icon, name, cloud provider badge (AWS orange / Azure blue), category, field count, engine badges, ownership badge
- [ ] Click module card → detail page showing: all fields with types and classifications, renderer info, field mappings table
- [ ] Modules without renderers clearly marked: "Canvas only — deploy not available" with grey border
- [ ] Module counts in filter: "Compute (5)" "Database (4)" etc.
- [ ] Search bar: filter modules by name or description

### Tasks
1. Create ModulesController with index and show actions
2. Create module registry index view with filter bar and module grid
3. Create module card partial with cloud provider badge, engine badges
4. Create module detail view with fields table, renderer info, mappings
5. Implement filter logic (cloud provider, category, ownership, search)
6. Style everything with F50 design system

---

## Requirement 6: Resource CRUD & Canvas API

### Description
Implement the Resource model and JSON API endpoints for canvas CRUD. Resources are instances of modules placed on an environment's canvas.

### Acceptance Criteria
- [ ] Resource model:
  - belongs_to :environment
  - belongs_to :module_definition
  - name (string, auto-generated from module name + random suffix)
  - config (jsonb — user_config field values)
  - zone: "public" | "private"
  - validation_errors (jsonb — cached validation results)
  - position_x, position_y (float — canvas position)
- [ ] Connection model (separate model, not jsonb):
  - belongs_to :from_resource, class_name: "Resource"
  - belongs_to :to_resource, class_name: "Resource"
  - connection_type: "dependency" | "reference"
  - Unique constraint: [from_resource_id, to_resource_id]
  - Cascade delete when either resource is deleted
- [ ] JSON API endpoints under /api/v1/environments/:environment_id/:
  - GET /resources — list all resources with module definitions and connections
  - POST /resources — create from module_definition_id, auto-populate config defaults (respecting defaults_by_env)
  - PATCH /resources/:id — update config, position, zone, name
  - DELETE /resources/:id — remove resource and cascade connections
  - POST /connections — create connection (from_resource_id, to_resource_id)
  - DELETE /connections/:id — remove connection
- [ ] Resource creation validates: module is visible to this customer, module's cloud_provider matches environment
- [ ] All endpoints scoped to current user's tenant
- [ ] Pundit policies: viewers read, developers edit, project_admin+ delete
- [ ] Field validation on save: required fields, min/max, enum constraints from ModuleField.validation

### Tasks
1. Create Resource migration and model
2. Create Connection migration and model with cascade deletes
3. Create Api::V1::ResourcesController with full CRUD
4. Create Api::V1::ConnectionsController
5. Implement default config population from module fields (with defaults_by_env)
6. Implement cloud_provider validation (module must match environment)
7. Implement field validation service
8. Create ResourcePolicy and ConnectionPolicy
9. Create JSON serializers (jbuilder or active_model_serializers) including module field definitions
10. Write request specs for all endpoints

---

## Requirement 7: Minimal Canvas Frontend

### Description
Build a minimal canvas page for an environment: module catalog sidebar (filtered by cloud provider), draggable resource blocks, SVG connection lines, and a properties panel as a Turbo Frame for editing resource configuration.

### Acceptance Criteria
- [ ] Environment show page renders three-column layout: catalog (220px left), canvas (flex center), properties (260px right)
- [ ] Module catalog sidebar:
  - Only shows modules matching the environment's cloud_provider (+ "multi")
  - Grouped by category with collapsible sections
  - Search filter
  - Click module → POST /resources → new block appears on canvas
  - Modules without renderers show "(canvas only)" label but are still addable
- [ ] Canvas area:
  - Dot-grid background (#1e2a3d55 dots at 20px intervals)
  - Environment type tabs at top: dev / acc / prd (switch updates URL)
  - Resource blocks rendered at (position_x, position_y)
  - Blocks show: module icon, resource name, module sub-type
  - Blocks are draggable (Stimulus controller), position saved on mouseup (PATCH)
  - Click block → selects it (green border), loads properties panel
  - Click empty canvas → deselects
- [ ] Connection drawing:
  - "Connect" button on selected resource activates connect mode
  - Crosshair cursor, purple indicator bar "Click target resource or canvas to cancel"
  - Click second resource → POST /connections
  - SVG bezier curves rendered between connected blocks
- [ ] Properties panel (Turbo Frame):
  - Loads server-rendered HTML for selected resource: GET /resources/:id/properties
  - Renders fields grouped by ModuleField.group
  - Input types match field_type: text input, number input with stepper, select dropdown, toggle switch
  - Classification sections: "Configuration" (user_config fields), "Dependencies" (dependency fields — read-only placeholders for now), "Platform" (platform_managed — hidden or read-only)
  - Save button submits form → PATCH /resources/:id → re-renders Turbo Frame
  - Delete button with confirmation
  - "Connect" button to initiate connection
- [ ] Empty state: "Click a module from the catalog to add it to the canvas"

### Tasks
1. Create EnvironmentsController#show with canvas layout
2. Create _catalog partial with cloud-provider-filtered modules, search, categories
3. Create canvas Stimulus controller: block rendering, drag-and-drop, selection, connect mode
4. Create _resource_block partial (icon, name, sub-type, selection state)
5. Create SVG connection line rendering in Stimulus controller
6. Create ResourcesController#properties action (returns Turbo Frame HTML)
7. Create _properties partial: dynamically renders fields from ModuleField definitions
8. Create field input partials: _text_field, _number_field, _select_field, _toggle_field
9. Wire catalog click → POST → render new block (Turbo Stream or Stimulus fetch)
10. Wire drag end → PATCH position
11. Wire properties save → PATCH config → Turbo Frame refresh
12. Wire delete → DELETE → remove block from canvas
13. Style everything with F50 dark theme

---

## Requirement 8: Python Pipeline Service — First Deploy

### Description
Create the Python FastAPI service that receives plan/deploy requests from Rails, generates OpenTofu code from the Intermediate Representation, and runs `tofu plan`. Rails is the sole API — Python is only called internally by Rails, never by the browser.

### Acceptance Criteria
- [ ] FastAPI app with routes:
  - POST /jobs/plan — async: generate code + run tofu plan, callback to Rails
  - POST /jobs/deploy — async: generate code + run tofu apply, callback to Rails
  - POST /scan — sync: scan module source, return discovered vars/outputs
  - GET /health — health check
- [ ] Service-to-service auth: shared secret token in X-Service-Token header (NOT Keycloak)
- [ ] IR (Intermediate Representation) input format accepted from Rails
- [ ] Code generator for OpenTofu:
  - Produces: main.tf, variables.tf, outputs.tf, provider.tf, backend.tf
  - Jinja2 templates: module_block.tf.j2, provider.tf.j2, backend.tf.j2
  - Field mappings applied: platform field → renderer variable
  - Tags injected into every module block
- [ ] Git credential injection via .netrc for private module sources
- [ ] OpenTofu engine: runs `tofu init` + `tofu plan -out=plan.bin` in temp workspace
- [ ] Callback to Rails: POST to callback_url with { status, plan_output, resource_changes }
- [ ] Cleanup: temp workspace + .netrc deleted after job
- [ ] Celery worker for async job execution, Redis as broker
- [ ] Dockerfile for the pipeline service

### Tasks
1. Initialize FastAPI project: api/, core/, generators/opentofu/, engines/, workers/
2. Create auth middleware for service token
3. Create IR parser and data classes
4. Create OpenTofu generator with Jinja2 templates
5. Create module_block.tf.j2 (source, variables with mappings, tags)
6. Create provider.tf.j2 (AWS provider with assume_role)
7. Create backend.tf.j2 (S3 backend)
8. Create tag_merger.py
9. Create opentofu_engine.py (init, plan, apply)
10. Create .netrc injection + cleanup
11. Create Celery app with plan_task and deploy_task
12. Create callback client (POST results to Rails)
13. Create /scan endpoint for module source scanning (python-hcl2)
14. Create Dockerfile
15. Write tests for code generator and tag merger

---

## Requirement 9: Rails ↔ Python Integration

### Description
Wire Rails to the Python pipeline service. Rails dispatches jobs and receives results via callbacks. Deploy status pushed to browser via Turbo Stream.

### Acceptance Criteria
- [ ] PipelineClient service object: HTTP client for Python service with retries, timeouts, service token
- [ ] Deployment model: belongs_to environment, belongs_to triggered_by (User), status (pending|dispatched|planning|planned|applying|completed|failed), plan_output (text), result (jsonb), started_at, completed_at
- [ ] DeployService:
  - Assembles IR from environment resources (including renderer + field mappings per resource)
  - Decrypts AWS credentials
  - Assembles merged tags from tenant hierarchy
  - Dispatches to Python with callback_url
  - Creates Deployment record
- [ ] Api::CallbacksController (internal, service token auth):
  - Receives Python callback
  - Updates Deployment status and result
  - Broadcasts via Turbo Stream to update browser
- [ ] Deploy panel on environment page:
  - "Plan" button → dispatches plan job → shows plan output when callback arrives
  - Status indicator: pending → planning → planned (with output)
- [ ] TagMergerService: walks reseller → customer → project → environment tags, merges into flat dict

### Tasks
1. Create Deployment migration and model
2. Create PipelineClient service (Faraday with retries)
3. Create IRBuilder service: assembles IR JSON from environment resources
4. Create DeployService with trigger_plan method
5. Create Api::CallbacksController with service token verification
6. Create AwsCredentialService for STS AssumeRole (reads from Environment config)
7. Create TagMergerService
8. Create deploy panel partial with Plan button
9. Wire Turbo Stream broadcast on Deployment status change
10. Create plan output display (monospace block)
11. Write integration specs for the full plan flow

---

## Requirement 10: Docker Compose Development Environment

### Description
Docker Compose setup for local development. Keycloak is already running separately — compose includes Rails, PostgreSQL, Redis, and the Python pipeline service.

### Acceptance Criteria
- [ ] docker-compose.yml with services: rails, postgres, redis, pipeline
- [ ] Keycloak connection configured via environment variables (points to existing Keycloak)
- [ ] Rails connects to PostgreSQL and Redis
- [ ] Pipeline service connects to Redis (Celery broker)
- [ ] Volume mounts for Rails and pipeline code (hot reload)
- [ ] .env.example documenting all required variables
- [ ] bin/setup script: db:create, db:migrate, db:seed
- [ ] README.md with development setup

### Tasks
1. Create docker-compose.yml with rails, postgres, redis, pipeline services
2. Create Dockerfile for Python pipeline service
3. Create .env.example
4. Create bin/setup script
5. Update README.md with setup instructions

---

## Definition of Done (Slice 1)
A developer can:
1. Run `docker compose up` to start Rails + PostgreSQL + Redis + Pipeline service
2. Visit the app, sign in via existing Keycloak
3. See the tenant hierarchy: Cloudsisters > Immovlan BV > Immovlan AWS
4. Navigate to the development environment (AWS, eu-west-1)
5. See the module catalog showing only AWS modules (no Azure AKS visible)
6. See modules grouped by category: Compute (4), Database (4), Networking (2), Storage (2), Security (2)
7. See VPC has a green "Deployable" badge, other modules show "Canvas only"
8. Click VPC → it appears on the canvas as a draggable block
9. Click the VPC block → properties panel shows: CIDR (text), NAT Gateway (toggle), AZ Count (number stepper)
10. Change CIDR to 10.1.0.0/16, click Save
11. Click "Plan" → see real `tofu plan` output showing VPC with CIDR 10.1.0.0/16 and merged tags
12. Navigate to Module Registry → see all 15 AWS modules + 1 Azure module, filter by cloud provider