"""Inject .netrc credentials for git access during tofu init."""

from __future__ import annotations
import os
from pathlib import Path
from contextlib import contextmanager


@contextmanager
def inject_netrc(git_credentials: list[dict]):
    """Temporarily write .netrc for git credential access, clean up after."""
    if not git_credentials:
        yield
        return

    netrc_path = Path.home() / ".netrc"
    backup = None

    if netrc_path.exists():
        backup = netrc_path.read_text()

    try:
        lines = []
        for cred in git_credentials:
            lines.append(f"machine {cred['host']}")
            lines.append(f"login oauth2")
            lines.append(f"password {cred['token']}")
            lines.append("")

        netrc_path.write_text("\n".join(lines))
        os.chmod(netrc_path, 0o600)
        yield
    finally:
        if backup is not None:
            netrc_path.write_text(backup)
        elif netrc_path.exists():
            netrc_path.unlink()
