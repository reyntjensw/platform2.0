"""Suggest UI groups for module fields based on variable name patterns."""

from __future__ import annotations

import re

GROUP_RULES = [
    {"pattern": r"version|engine", "group": "Version & Engine"},
    {"pattern": r"instance|node|cpu|memory|size|count|capacity", "group": "Sizing"},
    {"pattern": r"encrypt|kms|ssl|tls|certificate|secret", "group": "Security"},
    {"pattern": r"backup|retention|snapshot|recovery", "group": "Backup & Recovery"},
    {"pattern": r"enable_|use_|activate_", "group": "Add-ons"},
    {"pattern": r"log|monitor|metric|alarm|alert", "group": "Monitoring"},
    {"pattern": r"network|vpc|subnet|cidr|port|protocol", "group": "Networking"},
    {"pattern": r"storage|volume|disk|ebs", "group": "Storage"},
    {"pattern": r"iam|role|policy|permission", "group": "IAM"},
    {"pattern": r"tag|label|annotation", "group": "Tags"},
]


def suggest_group(name: str) -> str:
    """Suggest a UI group for a variable based on its name."""
    for rule in GROUP_RULES:
        if re.search(rule["pattern"], name, re.IGNORECASE):
            return rule["group"]
    return "General"
