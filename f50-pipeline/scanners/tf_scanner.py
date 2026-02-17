"""Terraform/OpenTofu module scanner — parses .tf files to extract variables and outputs."""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
import time
from pathlib import Path

from scanners.classifier import classify_variable, suggest_field_type, FIELD_TYPE_MAPPING
from scanners.group_suggester import suggest_group


def scan_module(
    source_url: str,
    source_ref: str,
    source_subpath: str | None = None,
    engine: str = "opentofu",
    git_token: str | None = None,
) -> dict:
    """Clone a module repo, parse .tf files, and return classified variables + outputs."""
    start = time.time()
    tmp_dir = None

    try:
        tmp_dir = tempfile.mkdtemp(prefix="f50_scan_")
        tmp_path = Path(tmp_dir)

        # Clone
        clone_url = _inject_token(source_url, git_token) if git_token else source_url
        _clone_repo(clone_url, tmp_path / "repo", source_ref)

        # Resolve subpath
        module_path = tmp_path / "repo"
        if source_subpath:
            module_path = module_path / source_subpath
            if not module_path.exists():
                return _error("subpath_not_found", f"Subpath '{source_subpath}' does not exist in the repository.")

        # Detect .tf files
        tf_files = sorted(module_path.glob("*.tf"))
        if not tf_files:
            return _error("no_tf_files", "No .tf files found in the module directory.")

        file_names = [f.name for f in tf_files]

        # Parse all .tf files
        all_blocks = {}
        for tf_file in tf_files:
            parsed = _parse_hcl(tf_file)
            if parsed:
                for key, val in parsed.items():
                    all_blocks.setdefault(key, []).extend(val if isinstance(val, list) else [val])

        # Extract variables
        variables = _extract_variables(all_blocks)

        # Extract outputs
        outputs = _extract_outputs(all_blocks)

        # Extract terraform version + providers
        tf_version = _extract_tf_version(all_blocks)
        providers = _extract_providers(all_blocks)

        duration_ms = int((time.time() - start) * 1000)

        return {
            "status": "success",
            "scan_duration_ms": duration_ms,
            "files_detected": file_names,
            "terraform_version_constraint": tf_version,
            "provider_requirements": providers,
            "variables": variables,
            "outputs": outputs,
        }

    except ScanError as e:
        return _error(e.error_type, str(e))
    except subprocess.TimeoutExpired:
        return _error("timeout", "Scan timed out after 30 seconds.")
    except Exception as e:
        return _error("internal_error", f"Unexpected error: {e}")
    finally:
        if tmp_dir:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)


class ScanError(Exception):
    def __init__(self, error_type: str, message: str):
        self.error_type = error_type
        super().__init__(message)


def _inject_token(url: str, token: str) -> str:
    """Inject token into HTTPS git URL for authentication."""
    if url.startswith("https://"):
        return url.replace("https://", f"https://oauth2:{token}@")
    if url.startswith("git::https://"):
        return url.replace("git::https://", f"git::https://oauth2:{token}@")
    return url


def _clone_repo(url: str, dest: Path, ref: str) -> None:
    """Shallow clone a git repo at a specific ref."""
    # Strip git:: prefix for actual git clone
    clone_url = url.removeprefix("git::")

    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", ref, clone_url, str(dest)],
            capture_output=True, text=True, timeout=30, check=True,
        )
    except subprocess.CalledProcessError as e:
        stderr = e.stderr or ""
        if "Authentication" in stderr or "could not read" in stderr:
            raise ScanError("clone_failed", f"Authentication failed for '{clone_url}'")
        if "not found" in stderr.lower() or "does not exist" in stderr.lower():
            raise ScanError("clone_failed", f"Repository or ref '{ref}' not found.")
        raise ScanError("clone_failed", f"Clone failed: {stderr.strip()}")


def _parse_hcl(tf_file: Path) -> dict | None:
    """Parse a .tf file using python-hcl2."""
    try:
        import hcl2
        with open(tf_file) as f:
            return hcl2.load(f)
    except ImportError:
        # Fallback: regex-based parsing
        return _parse_hcl_regex(tf_file)
    except Exception:
        return _parse_hcl_regex(tf_file)


def _parse_hcl_regex(tf_file: Path) -> dict:
    """Fallback regex parser for .tf files when hcl2 is not available."""
    content = tf_file.read_text()
    result = {}

    # Parse variable blocks
    variables = []
    for match in re.finditer(r'variable\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}', content, re.DOTALL):
        name = match.group(1)
        body = match.group(2)
        var = {"name": name}

        type_match = re.search(r'type\s*=\s*(.+?)$', body, re.MULTILINE)
        if type_match:
            var["type"] = type_match.group(1).strip()

        desc_match = re.search(r'description\s*=\s*"([^"]*)"', body)
        if desc_match:
            var["description"] = desc_match.group(1)

        default_match = re.search(r'default\s*=\s*(.+?)$', body, re.MULTILINE)
        if default_match:
            var["default"] = _parse_default(default_match.group(1).strip())

        sensitive_match = re.search(r'sensitive\s*=\s*(true|false)', body)
        if sensitive_match:
            var["sensitive"] = sensitive_match.group(1) == "true"

        variables.append({name: var})

    if variables:
        result["variable"] = variables

    # Parse output blocks
    outputs = []
    for match in re.finditer(r'output\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}', content, re.DOTALL):
        name = match.group(1)
        body = match.group(2)
        out = {"name": name}

        desc_match = re.search(r'description\s*=\s*"([^"]*)"', body)
        if desc_match:
            out["description"] = desc_match.group(1)

        sensitive_match = re.search(r'sensitive\s*=\s*(true|false)', body)
        if sensitive_match:
            out["sensitive"] = sensitive_match.group(1) == "true"

        outputs.append({name: out})

    if outputs:
        result["output"] = outputs

    # Parse terraform block for version constraints
    tf_match = re.search(r'terraform\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}', content, re.DOTALL)
    if tf_match:
        result["terraform"] = [_parse_terraform_block(tf_match.group(1))]

    return result


def _parse_default(raw: str):
    """Parse a Terraform default value."""
    raw = raw.strip().rstrip(",")
    if raw in ("true", "false"):
        return raw == "true"
    if raw == "null":
        return None
    if raw.startswith('"') and raw.endswith('"'):
        return raw[1:-1]
    if raw.startswith("{"):
        return {}
    if raw.startswith("["):
        return []
    try:
        return int(raw)
    except ValueError:
        try:
            return float(raw)
        except ValueError:
            return raw


def _parse_terraform_block(body: str) -> dict:
    """Parse terraform {} block for version constraints."""
    result = {}
    version_match = re.search(r'required_version\s*=\s*"([^"]*)"', body)
    if version_match:
        result["required_version"] = version_match.group(1)
    return result


def _extract_variables(blocks: dict) -> list[dict]:
    """Extract and classify variables from parsed HCL blocks."""
    variables = []
    for var_block in blocks.get("variable", []):
        for var_name, var_data in var_block.items():
            if isinstance(var_data, dict):
                var_info = _build_variable_info(var_name, var_data)
            else:
                var_info = _build_variable_info(var_name, {})
            variables.append(var_info)
    return variables


def _build_variable_info(name: str, data: dict) -> dict:
    """Build a classified variable info dict."""
    tf_type = _normalize_type(data.get("type", "string"))
    description = data.get("description", "")
    default = data.get("default")
    sensitive = data.get("sensitive", False)
    required = default is None and not sensitive

    # Validation rules
    validation_rules = []
    for v in data.get("validation", []):
        if isinstance(v, dict):
            validation_rules.append({
                "condition": v.get("condition", ""),
                "error_message": v.get("error_message", ""),
            })

    # Classification
    classification, reason = classify_variable(name, tf_type, description, default)

    # Field type suggestion
    suggested_field_type = suggest_field_type(name, tf_type, validation_rules)

    # Group suggestion
    suggested_group = suggest_group(name)

    result = {
        "name": name,
        "type": tf_type,
        "description": description,
        "default": default,
        "required": required,
        "sensitive": sensitive,
        "validation_rules": validation_rules,
        "suggested_classification": classification,
        "classification_reason": reason,
        "suggested_field_type": suggested_field_type,
        "suggested_group": suggested_group,
    }

    # Add dependency suggestion if classified as dependency
    if classification == "dependency":
        result["suggested_dependency"] = _suggest_dependency(name)

    return result


def _normalize_type(raw_type) -> str:
    """Normalize a Terraform type expression to a simple string."""
    if isinstance(raw_type, list):
        # hcl2 returns types as lists like ['string'] or ['list', ['string']]
        if len(raw_type) == 1:
            return str(raw_type[0])
        if len(raw_type) == 2:
            inner = raw_type[1]
            if isinstance(inner, list) and len(inner) == 1:
                return f"{raw_type[0]}({inner[0]})"
            return f"{raw_type[0]}({inner})"
        return str(raw_type)
    return str(raw_type).strip().strip('"')


def _suggest_dependency(name: str) -> dict:
    """Suggest dependency source based on variable name patterns."""
    suggestions = {
        "vpc_id": {"source_module_category": "networking", "source_module_name": "vpc", "source_output": "vpc_id"},
        "subnet_ids": {"source_module_category": "networking", "source_module_name": "vpc", "source_output": "private_subnet_ids"},
        "private_subnet_ids": {"source_module_category": "networking", "source_module_name": "vpc", "source_output": "private_subnet_ids"},
        "public_subnet_ids": {"source_module_category": "networking", "source_module_name": "vpc", "source_output": "public_subnet_ids"},
        "security_group_ids": {"source_module_category": "networking", "source_module_name": "vpc", "source_output": "default_security_group_id"},
    }
    if name in suggestions:
        return suggestions[name]

    # Generic fallback
    if name.endswith("_id"):
        base = name.removesuffix("_id")
        return {"source_module_category": "unknown", "source_module_name": base, "source_output": name}
    if name.endswith("_ids"):
        base = name.removesuffix("_ids")
        return {"source_module_category": "unknown", "source_module_name": base, "source_output": name}
    if name.endswith("_arn"):
        base = name.removesuffix("_arn")
        return {"source_module_category": "unknown", "source_module_name": base, "source_output": name}

    return {"source_module_category": "unknown", "source_module_name": "unknown", "source_output": name}


def _extract_outputs(blocks: dict) -> list[dict]:
    """Extract outputs from parsed HCL blocks."""
    outputs = []
    for out_block in blocks.get("output", []):
        for out_name, out_data in out_block.items():
            if isinstance(out_data, dict):
                outputs.append({
                    "name": out_name,
                    "type": _normalize_type(out_data.get("type", "string")),
                    "description": out_data.get("description", ""),
                    "sensitive": out_data.get("sensitive", False),
                })
            else:
                outputs.append({"name": out_name, "type": "string", "description": "", "sensitive": False})
    return outputs


def _extract_tf_version(blocks: dict) -> str | None:
    """Extract terraform required_version constraint."""
    for tf_block in blocks.get("terraform", []):
        if isinstance(tf_block, dict):
            if "required_version" in tf_block:
                return tf_block["required_version"]
    return None


def _extract_providers(blocks: dict) -> dict:
    """Extract required_providers from terraform block."""
    providers = {}
    for tf_block in blocks.get("terraform", []):
        if isinstance(tf_block, dict):
            for rp in tf_block.get("required_providers", []):
                if isinstance(rp, dict):
                    for name, config in rp.items():
                        if isinstance(config, dict):
                            providers[name] = {
                                "source": config.get("source", ""),
                                "version": config.get("version", ""),
                            }
    return providers


def _error(error_type: str, message: str) -> dict:
    return {"status": "error", "error_type": error_type, "error_message": message}
