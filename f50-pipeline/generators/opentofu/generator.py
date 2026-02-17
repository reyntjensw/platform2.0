"""OpenTofu code generator — IR to .tf files using Jinja2 templates."""

from __future__ import annotations
import os
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from core.ir_parser import IR
from core.tag_merger import merge_tags

TEMPLATE_DIR = Path(__file__).parent / "templates"


def generate(ir: IR, output_dir: str) -> list[str]:
    """Generate .tf files from an IR into output_dir. Returns list of generated file paths."""
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), keep_trailing_newline=True)
    os.makedirs(output_dir, exist_ok=True)
    generated = []

    context = {
        "environment": ir.environment,
        "credentials": ir.credentials,
        "backend": ir.backend,
        "tags": ir.tags,
    }

    # Inject tags into each module's variables
    enriched_modules = []
    for mod in ir.modules:
        enriched_vars = merge_tags(ir.tags, mod.variables)
        mod.variables = enriched_vars
        enriched_modules.append(mod)

    context["modules"] = enriched_modules

    templates = [
        ("versions.tf.j2", "versions.tf"),
        ("backend_s3.tf.j2", "backend.tf"),
        ("provider_aws.tf.j2", "provider.tf"),
        ("module_block.tf.j2", "main.tf"),
    ]

    for template_name, output_name in templates:
        tmpl = env.get_template(template_name)
        content = tmpl.render(**context)
        filepath = os.path.join(output_dir, output_name)
        with open(filepath, "w") as f:
            f.write(content)
        generated.append(filepath)

    return generated
