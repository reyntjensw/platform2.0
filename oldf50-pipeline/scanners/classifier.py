"""Auto-classification rules for Terraform variables."""

from __future__ import annotations

import re

# Classification rules — ordered by priority (first match wins)
CLASSIFICATION_RULES = [
    # Platform-managed patterns
    {"pattern": r"^tags$", "classification": "platform_managed", "reason": "Standard tags field"},
    {"pattern": r"^environment$", "classification": "platform_managed", "reason": "Environment name injection"},
    {"pattern": r"^name_prefix$", "classification": "platform_managed", "reason": "Naming prefix injection"},
    {"pattern": r"^name$", "classification": "platform_managed", "reason": "Resource name injection"},
    {"pattern": r"^region$", "classification": "platform_managed", "reason": "Region injection"},
    {"pattern": r"^aws_region$", "classification": "platform_managed", "reason": "AWS region injection"},
    {"pattern": r"^project$", "classification": "platform_managed", "reason": "Project name injection"},

    # Dependency patterns
    {"pattern": r"_id$", "classification": "dependency", "reason": "Ends with _id — reference to another resource"},
    {"pattern": r"_ids$", "classification": "dependency", "reason": "Ends with _ids — list of resource references"},
    {"pattern": r"_arn$", "classification": "dependency", "reason": "Ends with _arn — ARN reference"},
    {"pattern": r"_arns$", "classification": "dependency", "reason": "Ends with _arns — list of ARN references"},
    {"pattern": r"^subnet", "classification": "dependency", "reason": "Subnet reference"},
    {"pattern": r"security_group", "classification": "dependency", "reason": "Security group reference"},
    {"pattern": r"^kms_key", "classification": "dependency", "reason": "KMS key reference"},
    {"pattern": r"^role_arn$", "classification": "dependency", "reason": "IAM role ARN reference"},
    {"pattern": r"^certificate_arn$", "classification": "dependency", "reason": "ACM certificate reference"},
]

# Field type mapping from Terraform types to F50 field types
FIELD_TYPE_MAPPING = {
    "string": "string",
    "number": "integer",
    "bool": "boolean",
    "list(string)": "list",
    "list(number)": "list",
    "set(string)": "list",
    "map(string)": "object",
    "map(any)": "object",
    "any": "string",
    "object": "object",
}


def classify_variable(
    name: str,
    tf_type: str,
    description: str = "",
    default=None,
) -> tuple[str, str]:
    """Classify a variable based on its name, type, and metadata.

    Returns (classification, reason) tuple.
    """
    for rule in CLASSIFICATION_RULES:
        if re.search(rule["pattern"], name):
            return rule["classification"], rule["reason"]

    # Default: user_config
    reason_parts = []
    if description:
        reason_parts.append("has description")
    reason_parts.append(f"{tf_type} type")
    if default is not None:
        reason_parts.append("has default value")
    else:
        reason_parts.append("no default (required)")

    return "user_config", f"No pattern match — {', '.join(reason_parts)}"


def suggest_field_type(name: str, tf_type: str, validation_rules: list[dict] | None = None) -> str:
    """Suggest a F50 field type based on TF type and validation rules."""
    # Check if validation rules suggest an enum (regex with | pattern)
    if validation_rules:
        for rule in validation_rules:
            condition = rule.get("condition", "")
            # Look for contains() or regex with pipe-separated values
            enum_match = re.search(r'contains\(\[([^\]]+)\]', condition)
            if enum_match:
                return "enum"
            # Regex with alternation
            if "|" in condition and "regex" in condition:
                return "enum"

    # Map from TF type
    normalized = tf_type.lower().strip()
    return FIELD_TYPE_MAPPING.get(normalized, "string")
