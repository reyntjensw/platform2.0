# Module Import System — Comprehensive Implementation Spec

## Overview
The module import system is how modules enter Factor Fifty. There are four import paths: platform modules curated by Cloudsisters, reseller modules added by MSP partners, customer BYOM (Bring Your Own Module) from their own Git repos, and Terraform Registry modules from the public registry. Each path ends at the same place: a ModuleDefinition with classified fields, a renderer, and field mappings — ready for the canvas.

This spec covers the complete lifecycle: source URL entry → Git credential management → scanning → auto-classification → human review → metadata assignment → field mapping → activation → version management → upgrades.

## Architecture References
- Addendum Sections A1 (GitLab Integration), A7 (Scanner), A11 (BYOM & Multi-Cloud)
- Main Architecture Section 5 (Module System)

## Prerequisites
- Module data models in place (ModuleDefinition, ModuleField, ModuleOutput, ModuleRenderer, FieldMapping, GitCredential)
- Python pipeline service running with /scan endpoint
- Keycloak auth with roles (platform_admin, reseller_admin, customer_admin)

---

## The Four Import Paths

### Path 1: Platform Module (Cloudsisters-managed)
**Who:** Cloudsisters platform engineers (platform_admin role)
**Source:** `gitlab.cloudsisters.io/modules/aws-{name}.git`
**Visibility:** Global — all customers see it
**Quality bar:** Fully curated, tested, multi-engine renderers, documented, versioned tags
**Field mappings:** May have transforms (min_nodes → min_size) for multi-engine support

### Path 2: Reseller Module
**Who:** Reseller admin (reseller_admin role)
**Source:** Reseller's own Git server or Cloudsisters GitLab subgroup
**Visibility:** All customers under this reseller
**Quality bar:** Tested by reseller, usually single-engine (OpenTofu)
**Field mappings:** Usually 1:1 direct, unless reseller supports multiple engines

### Path 3: Customer BYOM
**Who:** Customer admin (customer_admin role)
**Source:** Customer's own GitHub, GitLab, Bitbucket, or any Git host
**Visibility:** Only that customer
**Quality bar:** Customer's responsibility — F50 scans and classifies but doesn't guarantee quality
**Field mappings:** Always 1:1 direct — customer's variable names become platform field names

### Path 4: Terraform Registry (Public)
**Who:** Any admin (customer_admin+)
**Source:** `registry.terraform.io/{namespace}/{name}/{provider}`
**Visibility:** Depends on who imports it (platform/reseller/customer scoped)
**Quality bar:** Community-maintained, F50 scans like any other module
**Field mappings:** 1:1 direct (registry modules already have well-defined variables)

---

## Requirement 1: Module Import Wizard — Multi-Step Form

### Description
A multi-step wizard that guides the user through importing a module. The wizard adapts its steps based on the import path and whether Git credentials already exist.

### Step Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: SOURCE                                                       │
│                                                                      │
│ Import from:                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │
│ │  🔗 Git URL  │ │ 📦 Registry  │ │ 📁 Upload    │ │ 📋 Template │ │
│ │  (default)   │ │  (TF Registry│ │  (.tf files) │ │  (from F50  │ │
│ │              │ │   or custom) │ │              │ │   catalog)  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │
│                                                                      │
│ Git URL:                                                             │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ https://github.com/acme-corp/terraform-aws-kafka.git           │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Version/Ref:          IaC Engine:          Cloud Provider:           │
│ ┌─────────────┐      ┌──────────────┐    ┌──────────────┐          │
│ │ v1.2.0   ▼  │      │ OpenTofu  ▼  │    │ AWS       ▼  │          │
│ └─────────────┘      └──────────────┘    └──────────────┘          │
│                                                                      │
│ Subpath (monorepo):   ┌────────────────────────────────┐            │
│                       │ modules/kafka  (optional)      │            │
│                       └────────────────────────────────┘            │
│                                                         [Next →]    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: AUTHENTICATION                                               │
│                                                                      │
│ ┌─ Existing credentials ─────────────────────────────────────────┐  │
│ │ ✓ github.com — Acme Corp PAT (expires 2025-12-01)     [Use]  │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ — or —                                                               │
│                                                                      │
│ ┌─ Add new credential ──────────────────────────────────────────┐  │
│ │ Name:    [Acme Corp GitHub______________]                     │  │
│ │ Type:    [Personal Access Token ▼]                            │  │
│ │ Token:   [ghp_****************************]                   │  │
│ │ Scope:   read_repository (read-only — F50 never writes)      │  │
│ │                                         [Verify & Save]      │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ⓘ Token is encrypted at rest. F50 only needs read access.           │
│                                                         [Next →]    │
└──────────────────────────────────────────────────────────────────────┘

  ↓ (step 2 is skipped for public repos or Terraform Registry)

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: SCANNING                                                     │
│                                                                      │
│ ┌─ Scan Progress ────────────────────────────────────────────────┐  │
│ │ ✓ Cloning repository...                              0.8s     │  │
│ │ ✓ Checking out v1.2.0...                             0.2s     │  │
│ │ ✓ Detecting module structure...                      0.1s     │  │
│ │ ● Parsing variables.tf...                            ···      │  │
│ │ ○ Parsing outputs.tf                                          │  │
│ │ ○ Auto-classifying variables                                  │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ Then resolves to:                                                    │
│                                                                      │
│ ┌─ Scan Results ─────────────────────────────────────────────────┐  │
│ │ ✓ Found 12 variables, 4 outputs                               │  │
│ │ ✓ Module structure valid                                       │  │
│ │ ✓ Auto-classified: 7 user_config, 3 dependency, 2 platform    │  │
│ │                                                                │  │
│ │ Files detected:                                                │  │
│ │   main.tf · variables.tf · outputs.tf · versions.tf            │  │
│ │   locals.tf · data.tf                                          │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                         [Next →]    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4: REVIEW & CLASSIFY VARIABLES                                  │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ Variable         │ TF Type    │ Default     │ Classification  │  │
│ ├──────────────────┼────────────┼─────────────┼─────────────────┤  │
│ │ cluster_name     │ string     │ —           │ [user_config ▼] │  │
│ │ kafka_version    │ string     │ "3.6.0"     │ [user_config ▼] │  │
│ │ broker_count     │ number     │ 3           │ [user_config ▼] │  │
│ │ instance_type    │ string     │ "m5.large"  │ [user_config ▼] │  │
│ │ ebs_volume_size  │ number     │ 100         │ [user_config ▼] │  │
│ │ encryption       │ bool       │ true        │ [user_config ▼] │  │
│ │ enhanced_mon     │ bool       │ true        │ [user_config ▼] │  │
│ │ vpc_id           │ string     │ —           │ [dependency  ▼] │← auto-detected (*_id)
│ │ subnet_ids       │ list(str)  │ —           │ [dependency  ▼] │← auto-detected (*_ids)
│ │ security_groups  │ list(str)  │ —           │ [dependency  ▼] │← auto-detected
│ │ tags             │ map(str)   │ {}          │ [platform    ▼] │← auto-detected
│ │ name_prefix      │ string     │ —           │ [platform    ▼] │← auto-detected
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─ Outputs ──────────────────────────────────────────────────────┐  │
│ │ bootstrap_brokers        │ string  │ Broker connection string  │  │
│ │ bootstrap_brokers_tls    │ string  │ TLS broker endpoints      │  │
│ │ cluster_arn              │ string  │ MSK cluster ARN           │  │
│ │ zookeeper_connect        │ string  │ ZooKeeper connection      │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ Classification guide:                                                │
│ 🟢 user_config  — User configures this in the properties panel      │
│ 🔵 dependency   — Auto-resolved from canvas connections              │
│ 🟣 platform     — Injected automatically by F50 (tags, naming)      │
│ ⚫ hidden       — Excluded from F50 (internal module variable)       │
│                                                         [Next →]    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5: CONFIGURE FIELDS                                             │
│                                                                      │
│ For each user_config variable, set display properties:               │
│                                                                      │
│ ┌─ cluster_name (string) ────────────────────────────────────────┐  │
│ │ Display Label:  [Cluster Name____________]                     │  │
│ │ UI Group:       [General ▼]                                    │  │
│ │ Required:       [● ON]                                         │  │
│ │ Default:        [________________] (no TF default)             │  │
│ │ Validation:     regex [^[a-z0-9-]+$_______]                    │  │
│ │ Help text:      [Name for the MSK cluster___]                  │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─ broker_count (number) ────────────────────────────────────────┐  │
│ │ Display Label:  [Broker Count____________]                     │  │
│ │ UI Group:       [Cluster Config ▼]                             │  │
│ │ Required:       [● ON]                                         │  │
│ │ Default:        [3]                                            │  │
│ │ Min: [1]  Max: [15]                                            │  │
│ │ Env Defaults:   dev [3]  acc [3]  prd [6]                     │  │
│ │ Locked in:      [ ] dev  [ ] acc  [●] prd                     │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─ kafka_version (string → enum) ────────────────────────────────┐  │
│ │ Display Label:  [Kafka Version___________]                     │  │
│ │ Field Type:     [Enum / Select ▼]  (override from string)     │  │
│ │ Options:        [3.6.0, 3.5.1, 3.4.0, 2.8.2]                 │  │
│ │ UI Group:       [Cluster Config ▼]                             │  │
│ │ Default:        [3.6.0]                                        │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ For dependency variables, configure source mapping:                  │
│                                                                      │
│ ┌─ vpc_id (dependency) ──────────────────────────────────────────┐  │
│ │ Connects to module type:  [VPC ▼]                              │  │
│ │ Uses output:              [vpc_id ▼]                           │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─ subnet_ids (dependency) ──────────────────────────────────────┐  │
│ │ Connects to module type:  [VPC ▼]                              │  │
│ │ Uses output:              [private_subnet_ids ▼]               │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                         [Next →]    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 6: MODULE METADATA                                              │
│                                                                      │
│ Display Name:   [MSK Kafka Cluster_________]                         │
│ Internal Name:  [msk-kafka] (auto-generated, editable)               │
│ Description:    [Managed Kafka streaming with MSK___________]        │
│ Category:       [Database ▼]                                         │
│ Cloud Provider: [AWS] (from step 1, read-only)                       │
│ Icon:           [MSK]  (3-letter abbreviation for canvas)            │
│ Icon Color:     [● #3498db]  (color picker with presets)             │
│                                                                      │
│ Ownership:      [Customer Module] (auto-set based on user role)      │
│ Visibility:     [Only Acme Corp] (auto-set based on ownership)       │
│ Status:         [Draft ▼]  ← start as draft, promote to live        │
│                                                                      │
│ ┌─ Preview ──────────────────────────────────────────────────────┐  │
│ │ How this module will look on the canvas:                       │  │
│ │                                                                │  │
│ │  ┌───────────────────────────────────┐                        │  │
│ │  │ [MSK]  MSK Kafka Cluster          │                        │  │
│ │  │        Managed Kafka streaming    │                        │  │
│ │  └───────────────────────────────────┘                        │  │
│ │                                                                │  │
│ │ 7 configurable fields · 3 dependencies · 4 outputs             │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                                          [Save as Draft] [Publish]  │
└──────────────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Step 1 (Source): 4 import methods — Git URL (default), Terraform Registry, File Upload, F50 Template
- [ ] Git URL input: validates URL format, extracts host for credential lookup
- [ ] Version/Ref: dropdown listing Git tags (fetched after credential verification), or free-text for branch
- [ ] IaC Engine: dropdown (OpenTofu default, CloudFormation, CDK, Bicep — only OpenTofu for Slice 1)
- [ ] Cloud Provider: dropdown (AWS, Azure, GCP, Multi)
- [ ] Subpath: optional field for monorepo support (e.g., `modules/kafka`)
- [ ] Step 2 (Auth): shows existing GitCredentials matching the URL's host, option to add new credential
- [ ] New credential form: name, type (PAT/Deploy Token/SSH Key), token input (masked), "Verify & Save" button
- [ ] Verify tests the credential against the Git host (clone a small test, or API call)
- [ ] Token stored encrypted in GitCredential model
- [ ] Step 2 skipped for: public Git repos (no auth needed), Terraform Registry (uses public API)
- [ ] Step 3 (Scanning): real-time progress via polling or Turbo Stream (clone → checkout → detect → parse → classify)
- [ ] Scan calls Python pipeline `POST /scan` with source_url, source_ref, engine_hint, git_token
- [ ] Scan results show: variable count, output count, file list, classification summary
- [ ] Scan errors shown clearly: "Clone failed: authentication error", "No variables.tf found", "Parse error in main.tf line 42"
- [ ] Step 4 (Classify): table of all discovered variables with: name, TF type, default value, classification dropdown
- [ ] Auto-classification applied: `*_id` and `*_ids` → dependency, `tags`/`environment`/`name_prefix` → platform, rest → user_config
- [ ] Hidden option: mark variables as excluded (internal module variables user shouldn't see)
- [ ] Outputs listed as read-only table with name, type, description
- [ ] Step 5 (Configure): per-field configuration for user_config variables
- [ ] Field type override: can change "string" to "enum" if variable has known allowed values
- [ ] UI Group assignment: group fields logically ("General", "Cluster Config", "Networking", "Add-ons")
- [ ] Defaults by environment: set different defaults per env_type
- [ ] Locked in environments: check environments where this field shouldn't be changeable
- [ ] Dependency source mapping: for dependency fields, select which module type and output they connect to
- [ ] Step 6 (Metadata): display name, internal name, description, category, icon (3-letter), icon color
- [ ] Live preview of how the module will appear as a canvas block
- [ ] Ownership auto-set from user's role (platform_admin → platform, reseller_admin → reseller, customer_admin → customer)
- [ ] "Save as Draft" keeps status: draft (not visible on canvas), "Publish" sets status: live
- [ ] Back navigation: can go back to any previous step without losing data

### Tasks
1. Create `ModuleImportController` with step actions (source, auth, scan, classify, configure, metadata)
2. Create multi-step wizard layout with step indicator bar
3. Create Step 1 partial: source selection, URL input, version, engine, cloud provider
4. Create Step 2 partial: credential selection/creation with verification
5. Create Step 3 partial: scan progress display with Turbo Stream updates
6. Create Step 4 partial: classification review table with dropdowns
7. Create Step 5 partial: per-field configuration forms with env defaults, locked fields
8. Create Step 6 partial: metadata form with live canvas block preview
9. Create `ModuleImportService` orchestrating the full wizard flow
10. Implement Git tag listing (fetch available tags for version dropdown)
11. Wire scan to Python pipeline `POST /scan`
12. Implement auto-classification heuristic in Python classifier
13. Create `GitCredentialVerificationService` for testing credentials
14. Store wizard state across steps (session or database-backed draft)

---

## Requirement 2: Python Scanner — Variable Discovery & Classification

### Description
The Python pipeline `/scan` endpoint clones a module source, parses it based on the IaC engine, extracts variables and outputs, and suggests classifications.

### Scanner Input/Output Contract

```json
// POST /scan — Request
{
  "source_url": "https://github.com/acme-corp/terraform-aws-kafka.git",
  "source_ref": "v1.2.0",
  "source_subpath": null,
  "engine": "opentofu",
  "git_token": "ghp_xxxxxxxxxxxx"
}

// POST /scan — Response (success)
{
  "status": "success",
  "scan_duration_ms": 2340,
  "files_detected": ["main.tf", "variables.tf", "outputs.tf", "versions.tf", "locals.tf"],
  "terraform_version_constraint": ">= 1.5.0",
  "provider_requirements": {
    "aws": { "source": "hashicorp/aws", "version": ">= 5.0" }
  },
  "variables": [
    {
      "name": "cluster_name",
      "type": "string",
      "description": "Name of the MSK cluster",
      "default": null,
      "required": true,
      "sensitive": false,
      "validation_rules": [
        { "condition": "can(regex(\"^[a-z0-9-]+$\", var.cluster_name))", "error_message": "Must be lowercase alphanumeric with hyphens" }
      ],
      "suggested_classification": "user_config",
      "classification_reason": "No naming pattern match, has description, string type",
      "suggested_field_type": "text",
      "suggested_group": "General"
    },
    {
      "name": "vpc_id",
      "type": "string",
      "description": "VPC ID where the MSK cluster will be deployed",
      "default": null,
      "required": true,
      "sensitive": false,
      "validation_rules": [],
      "suggested_classification": "dependency",
      "classification_reason": "Name ends with _id, likely references another resource",
      "suggested_dependency": {
        "source_module_category": "networking",
        "source_module_name": "vpc",
        "source_output": "vpc_id"
      }
    },
    {
      "name": "tags",
      "type": "map(string)",
      "description": "Tags to apply to all resources",
      "default": {},
      "required": false,
      "sensitive": false,
      "validation_rules": [],
      "suggested_classification": "platform_managed",
      "classification_reason": "Name is 'tags', type is map — standard platform-injected field"
    }
  ],
  "outputs": [
    {
      "name": "bootstrap_brokers",
      "type": "string",
      "description": "Comma-separated list of broker endpoints",
      "sensitive": false
    },
    {
      "name": "cluster_arn",
      "type": "string",
      "description": "ARN of the MSK cluster",
      "sensitive": false
    }
  ]
}

// POST /scan — Response (error)
{
  "status": "error",
  "error_type": "clone_failed",
  "error_message": "Authentication failed for 'https://github.com/acme-corp/...'",
  "error_detail": "The provided token does not have access to this repository."
}
```

### Auto-Classification Rules

```python
CLASSIFICATION_RULES = [
    # Platform-managed patterns
    { "pattern": "^tags$",           "classification": "platform_managed", "reason": "Standard tags field" },
    { "pattern": "^environment$",    "classification": "platform_managed", "reason": "Environment name injection" },
    { "pattern": "^name_prefix$",    "classification": "platform_managed", "reason": "Naming prefix injection" },
    { "pattern": "^name$",          "classification": "platform_managed", "reason": "Resource name injection" },
    
    # Dependency patterns
    { "pattern": "_id$",            "classification": "dependency",       "reason": "Ends with _id — reference to another resource" },
    { "pattern": "_ids$",           "classification": "dependency",       "reason": "Ends with _ids — list of resource references" },
    { "pattern": "_arn$",           "classification": "dependency",       "reason": "Ends with _arn — ARN reference" },
    { "pattern": "_arns$",          "classification": "dependency",       "reason": "Ends with _arns — list of ARN references" },
    { "pattern": "^subnet",         "classification": "dependency",       "reason": "Subnet reference" },
    { "pattern": "security_group",  "classification": "dependency",       "reason": "Security group reference" },
    
    # Everything else → user_config (default)
]

FIELD_TYPE_MAPPING = {
    "string":       "text",      # default, overrideable to "enum" if validation has regex with | pattern
    "number":       "number",
    "bool":         "boolean",
    "list(string)": "list",
    "map(string)":  "object",
    "set(string)":  "list",
}

GROUP_SUGGESTION_RULES = [
    { "pattern": "version|engine",   "group": "Version & Engine" },
    { "pattern": "instance|node|cpu|memory|size|count", "group": "Sizing" },
    { "pattern": "encrypt|kms|ssl|tls", "group": "Security" },
    { "pattern": "backup|retention|snapshot", "group": "Backup & Recovery" },
    { "pattern": "enable_|use_",    "group": "Add-ons" },
    { "pattern": "log|monitor|metric", "group": "Monitoring" },
    # default group: "General"
]
```

### Acceptance Criteria
- [ ] Python `/scan` endpoint accepts source URL, ref, engine, optional git_token and subpath
- [ ] Clones repo with `--depth 1` (shallow) into temp directory
- [ ] Checks out specified ref (tag or branch)
- [ ] If subpath specified: enters subdirectory
- [ ] OpenTofu scanner: parses all `.tf` files using python-hcl2
- [ ] Extracts: variables (name, type, description, default, required, sensitive, validations)
- [ ] Extracts: outputs (name, type, description, sensitive)
- [ ] Extracts: terraform version constraint, required providers
- [ ] Auto-classifies each variable using pattern matching rules
- [ ] For dependency variables: suggests source module category + output name
- [ ] Suggests field_type mapping from TF type
- [ ] Suggests UI group based on variable name patterns
- [ ] Returns JSON response with full scan results
- [ ] Error handling: clone failures, parse errors, missing files — clear error types and messages
- [ ] Cleanup: temp directory deleted after scan (even on error)
- [ ] .netrc injection for authenticated repos, cleaned up after scan
- [ ] Scan timeout: 30 seconds max
- [ ] Response time: < 5 seconds for typical modules (< 20 files)

### Tasks
1. Create `scanners/tf_scanner.py` with python-hcl2 parsing
2. Create `scanners/classifier.py` with auto-classification rules
3. Create `scanners/group_suggester.py` for UI group suggestions
4. Create `api/routes/scan.py` endpoint
5. Implement .netrc injection and cleanup
6. Implement temp directory management
7. Implement timeout handling (30s)
8. Add provider and Terraform version extraction
9. Parse TF validation blocks from variables
10. Write tests for classification rules and scanner output

---

## Requirement 3: Terraform Registry Import

### Description
Alternative to Git URL: import a module directly from the Terraform Registry (registry.terraform.io) or a custom private registry. The wizard fetches module metadata from the registry API.

### Registry Flow

```
User enters: hashicorp/consul/aws
Version selection: fetches available versions from registry API
→ registry.terraform.io/v1/modules/hashicorp/consul/aws/versions
→ Shows version list, user picks one

Scanner fetches source:
→ registry.terraform.io/v1/modules/hashicorp/consul/aws/1.0.0/download
→ Gets redirect to GitHub source URL
→ Proceeds with normal Git-based scanning
```

### Acceptance Criteria
- [ ] Registry input field accepts: `{namespace}/{name}/{provider}` format
- [ ] Validates format and shows error if malformed
- [ ] Fetches version list from registry API (no auth needed for public registry)
- [ ] Version dropdown populated with available versions, latest pre-selected
- [ ] Fetching source URL from registry download endpoint
- [ ] Follows redirect to actual Git source
- [ ] Proceeds to normal scanning flow (Step 3 onwards)
- [ ] Shows registry badge: "From Terraform Registry" on the module card
- [ ] For private registries: requires registry token in Step 2
- [ ] Registry source URL stored for future version checks

### Tasks
1. Create `RegistryClient` service for Terraform Registry API
2. Implement version listing from registry API
3. Implement source URL resolution (download endpoint + redirect)
4. Add registry-specific UI in Step 1
5. Add registry badge to module metadata

---

## Requirement 4: File Upload Import (Offline / Air-Gapped)

### Description
For environments without Git access (air-gapped networks, quick testing), users can upload `.tf` files directly. The scanner processes the uploaded files instead of cloning a repo.

### Acceptance Criteria
- [ ] Upload area accepts: `.tf` files, `.zip` of a module directory, or a `.tar.gz`
- [ ] Drag-and-drop zone in Step 1 (alternative to Git URL)
- [ ] Uploaded files processed by the same scanner pipeline
- [ ] No Git credential needed
- [ ] No version management (single version, manually updated)
- [ ] Module renderer source_type set to "inline" (code stored in F50, not fetched from Git)
- [ ] Warning: "This module is not version-controlled. Consider using a Git repository for better version management."
- [ ] For inline modules: code generation embeds the module source directly instead of referencing a Git URL

### Tasks
1. Add file upload zone to Step 1 source selection
2. Handle .zip and .tar.gz extraction
3. Send extracted files to Python scanner
4. Store inline module source in database or S3
5. Update code generator to handle "inline" source_type
6. Show version management warning

---

## Requirement 5: Module Version Management & Upgrades

### Description
After a module is imported, new versions may be released. The version management system tracks versions, detects breaking changes, and provides an upgrade path per-resource.

### Data Model

```ruby
ModuleVersion
  belongs_to :module_renderer
  version_ref: string           # "v1.2.0"
  discovered_vars: jsonb        # snapshot of variables at this version
  discovered_outputs: jsonb     # snapshot of outputs at this version
  breaking: boolean             # true if incompatible with previous version
  changelog: text               # from Git tag message or CHANGELOG.md
  compatibility_report: jsonb   # { added: [...], removed: [...], changed: [...] }
  scanned_at: datetime
  published_at: datetime        # when this version was made available in F50

Resource
  renderer_ref: string          # pinned version "v1.2.0", nil = latest
  upgrade_available: boolean    # cached flag
  upgrade_report: jsonb         # what changes if upgraded

Environment
  upgrade_policy: string        # "auto" | "manual" | "locked"
```

### Version Detection Flow

```
New version detected (via GitLab webhook or manual "Check for updates"):

1. Python scans the new ref → discovers_vars + discovered_outputs
2. Compare old version vars vs new version vars:
   - New variables WITH defaults     → non-breaking (additive)
   - New variables WITHOUT defaults  → BREAKING (new required field)
   - Removed variables               → BREAKING (field no longer exists)
   - Variable type changed           → BREAKING (type mismatch)
   - Variable default changed        → non-breaking (default differs)
   - New outputs                     → non-breaking (additive)
   - Removed outputs                 → BREAKING (downstream may depend on it)

3. Store ModuleVersion with compatibility_report
4. Flag affected resources: upgrade_available = true

5. Notification:
   - Non-breaking: "Module aws-kafka v1.3.0 available — 2 new optional fields"
   - Breaking: "Module aws-kafka v2.0.0 available — ⚠ BREAKING: removed 'legacy_auth_mode'"
```

### Upgrade UI

```
┌─────────────────────────────────────────────────────────────────┐
│ MODULE UPDATES                                               🔔  │
│                                                                  │
│ ┌─ aws-kafka v1.2.0 → v1.3.0 ─────────────── Non-breaking ─┐  │
│ │                                                            │  │
│ │ Changes:                                                   │  │
│ │   + enable_logging (boolean, default: true)  — new field   │  │
│ │   + log_retention_days (number, default: 7)  — new field   │  │
│ │   ~ broker_count default: 3 → 5              — default ∆   │  │
│ │                                                            │  │
│ │ Affected resources (3):                                    │  │
│ │   ● dev / event-stream    → Can upgrade     [Upgrade]     │  │
│ │   ● acc / event-stream    → Can upgrade     [Upgrade]     │  │
│ │   ● prd / event-stream    → Can upgrade     [Upgrade]     │  │
│ │                                                            │  │
│ │                            [Upgrade All Compatible]        │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌─ aws-kafka v1.2.0 → v2.0.0 ─────────────── ⚠ BREAKING ───┐  │
│ │                                                            │  │
│ │ Breaking changes:                                          │  │
│ │   ✕ Removed: legacy_auth_mode                              │  │
│ │   ✕ Removed: zookeeper_mode                                │  │
│ │   ~ Changed type: broker_count string → number             │  │
│ │   + Added required: authentication_method (no default)     │  │
│ │                                                            │  │
│ │ Affected resources (3):                                    │  │
│ │   ● dev / event-stream    → ⚠ Uses legacy_auth_mode       │  │
│ │   ● acc / event-stream    → ⚠ Uses legacy_auth_mode       │  │
│ │   ● prd / event-stream    → 🔒 Locked — manual only       │  │
│ │                                                            │  │
│ │ ⚠ Manual review required. Removed fields must be          │  │
│ │   addressed before upgrading.                              │  │
│ │                                     [Review & Upgrade →]   │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] ModuleVersion created each time a module is scanned at a new ref
- [ ] Compatibility report auto-generated: added, removed, changed variables with breaking flag
- [ ] Resource.renderer_ref pins resources to a specific version
- [ ] New resources get the latest version by default
- [ ] Existing resources keep their pinned version — never auto-upgraded without consent
- [ ] "Check for Updates" button on module detail page triggers rescan at latest Git tag
- [ ] GitLab webhook also triggers version detection (auto)
- [ ] Upgrade UI shows: version diff, breaking/non-breaking, affected resources per environment
- [ ] "Upgrade" per-resource: updates renderer_ref, adds new fields with defaults, flags removed fields
- [ ] "Upgrade All Compatible" batch-upgrades all resources on non-breaking versions
- [ ] Breaking upgrades require per-resource manual review
- [ ] Environment upgrade_policy:
  - `auto`: non-breaking upgrades applied automatically (good for dev)
  - `manual`: all upgrades require explicit user action (default)
  - `locked`: no upgrades allowed — version pinned until admin changes policy
- [ ] After upgrade: resource needs re-deployment to take effect
- [ ] Upgrade history tracked: who upgraded, when, from which version to which

### Tasks
1. Create ModuleVersion migration and model
2. Create VersionComparisonService (diff old vs new vars)
3. Create BreakingChangeDetector
4. Add renderer_ref to Resource model
5. Add upgrade_available and upgrade_report to Resource
6. Add upgrade_policy to Environment
7. Create ModuleUpdatesController for upgrade UI
8. Create upgrade diff view
9. Create per-resource upgrade action
10. Create batch "Upgrade All Compatible" action
11. Create upgrade history tracking
12. Wire GitLab webhook to version detection
13. Wire "Check for Updates" manual trigger

---

## Requirement 6: Git Credential Management

### Description
A dedicated UI for managing Git credentials used for module scanning and deployment. Credentials are scoped to the owner (Reseller or Customer).

### Acceptance Criteria
- [ ] Git Credentials page in settings (reseller_admin+ or customer_admin for BYOM)
- [ ] List of credentials: name, host, type, scope, last verified, expires, active toggle
- [ ] "Add Credential" form: name, host (auto-detected from module URL), type (PAT/Deploy Token), token (masked input), scope display (read_repository)
- [ ] "Verify" button: tests credential against the host (shallow clone of a test repo or API call)
- [ ] Verification result: "✓ Connected to github.com as @username" or "✗ Authentication failed"
- [ ] Token rotation: "Rotate" button to update token without recreating the credential
- [ ] Expiration warning: credential card shows orange badge when token expires within 30 days
- [ ] Expiration notification: alert banner when any credential expires within 7 days
- [ ] Credentials auto-selected during module import based on URL host matching
- [ ] Credential lookup chain: customer credentials first, then reseller credentials (for BYOM)
- [ ] Delete with confirmation: "This credential is used by N module renderers. Deleting it will prevent scanning and deploying those modules."

### Tasks
1. Create GitCredentialsController with CRUD
2. Create credentials list view
3. Create credential form with masked token input
4. Implement verification service (test clone or API call)
5. Implement token rotation (update encrypted token)
6. Implement expiration tracking and warnings
7. Implement credential lookup chain (customer → reseller)
8. Add delete confirmation with affected module count

---

## Requirement 7: Module Registry — Browse & Manage

### Description
The Module Registry is the central hub for viewing all modules, their versions, field configurations, and import status. It supports filtering by cloud provider, category, ownership, and engine.

### Acceptance Criteria
- [ ] Registry page: grid of module cards, searchable and filterable
- [ ] Filters: Cloud (AWS/Azure/All), Category, Ownership (Platform/Reseller/My Modules), Engine, Status (Live/Draft/Deprecated)
- [ ] Module card shows: icon (colored), display name, cloud badge, category, field count, engine badges, ownership badge, version, status
- [ ] Cards with upgrades available: orange "Update available" badge
- [ ] Click card → module detail page:
  - Overview: name, description, version, source URL, scan status, last scanned
  - Fields tab: full table of all fields with classification, type, defaults, groups
  - Outputs tab: all outputs with types and descriptions
  - Versions tab: version history with compatibility reports
  - Renderers tab: list of renderers per engine with field mappings
  - Usage tab: list of environments/resources using this module
- [ ] "Edit" button on module detail: re-enter wizard at relevant step
- [ ] "Deprecate" action: marks module as deprecated, shows warning on canvas, blocks new instances
- [ ] "Delete" action: only if no resources use it, otherwise blocked with count
- [ ] "Re-scan" action: re-scans current version to update discovered vars
- [ ] Import button: opens the import wizard (Requirement 1)

### Tasks
1. Create ModulesController with index, show, edit, deprecate, destroy actions
2. Create module registry grid view with filters
3. Create module card partial
4. Create module detail page with tabs (Overview, Fields, Outputs, Versions, Renderers, Usage)
5. Create fields table view with inline editing capability
6. Create version history view
7. Create renderer and field mapping view
8. Create usage tracking (which environments/resources use this module)
9. Implement deprecation flow
10. Implement deletion guard (block if in use)

---

## Definition of Done

The module import system is complete when:

1. **Import Wizard:** 6-step wizard works end-to-end for Git URL source
2. **Scanner:** Python parses variables.tf + outputs.tf, returns classified results in < 5s
3. **Auto-Classification:** Dependency, platform, and user_config fields correctly suggested
4. **Field Configuration:** Per-field UI groups, env defaults, locked fields, type overrides
5. **Git Credentials:** Add, verify, rotate, expiration warnings, auto-selection by host
6. **Terraform Registry:** Can import modules from registry.terraform.io
7. **File Upload:** Can upload .tf files for air-gapped environments
8. **Module Detail:** Full detail page with fields, outputs, versions, renderers, usage
9. **Version Management:** New versions detected, compatibility reports generated, per-resource upgrades
10. **Breaking Changes:** Correctly identified, blocked from auto-upgrade, manual review flow
11. **BYOM:** Customer can import from their own GitHub with 1:1 field mappings
12. **Platform Modules:** Cloudsisters can import with field mapping transforms for multi-engine
13. **Module appears on canvas** after publishing and is filterable by cloud provider