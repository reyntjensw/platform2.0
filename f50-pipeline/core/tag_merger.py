"""Merge tags from IR into module variables."""


def merge_tags(ir_tags: dict, module_variables: dict) -> dict:
    """Merge IR-level tags into module variables.

    If the module already has a 'tags' variable, merge IR tags into it.
    Otherwise, inject the IR tags as the 'tags' variable.
    """
    existing = module_variables.get("tags", {})
    if not isinstance(existing, dict):
        existing = {}

    merged = {**ir_tags, **existing}
    return {**module_variables, "tags": merged}
