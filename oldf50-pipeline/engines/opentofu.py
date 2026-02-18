"""OpenTofu engine — runs tofu init, plan, apply in a workspace directory."""

from __future__ import annotations
import subprocess
import logging

logger = logging.getLogger(__name__)

TOFU_BIN = "tofu"


def run_command(cmd: list[str], cwd: str, timeout: int = 300) -> tuple[int, str, str]:
    """Run a shell command and return (returncode, stdout, stderr)."""
    logger.info(f"Running: {' '.join(cmd)} in {cwd}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return result.returncode, result.stdout, result.stderr


def init(workspace: str) -> tuple[bool, str]:
    """Run tofu init."""
    code, stdout, stderr = run_command([TOFU_BIN, "init", "-no-color"], cwd=workspace)
    output = stdout + stderr
    return code == 0, output


def plan(workspace: str) -> tuple[bool, str]:
    """Run tofu plan and save to plan.bin."""
    code, stdout, stderr = run_command(
        [TOFU_BIN, "plan", "-no-color", "-out=plan.bin", "-detailed-exitcode"],
        cwd=workspace, timeout=600
    )
    output = stdout + stderr
    # Exit code 2 means changes detected (success with diff)
    success = code in (0, 2)
    return success, output


def show_plan(workspace: str) -> tuple[bool, str]:
    """Run tofu show on the plan file."""
    code, stdout, stderr = run_command(
        [TOFU_BIN, "show", "-no-color", "plan.bin"],
        cwd=workspace
    )
    return code == 0, stdout + stderr


def apply(workspace: str) -> tuple[bool, str]:
    """Run tofu apply on the saved plan."""
    code, stdout, stderr = run_command(
        [TOFU_BIN, "apply", "-no-color", "-auto-approve", "plan.bin"],
        cwd=workspace, timeout=1800
    )
    return code == 0, stdout + stderr
