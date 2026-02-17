"""Terraform Registry API client for fetching module metadata and versions."""

from __future__ import annotations

import httpx

REGISTRY_BASE = "https://registry.terraform.io/v1/modules"


class RegistryError(Exception):
    pass


def list_versions(namespace: str, name: str, provider: str) -> list[str]:
    """Fetch available versions for a module from the Terraform Registry."""
    url = f"{REGISTRY_BASE}/{namespace}/{name}/{provider}/versions"
    try:
        resp = httpx.get(url, timeout=10, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json()
        versions = []
        for module in data.get("modules", []):
            for v in module.get("versions", []):
                versions.append(v["version"])
        return sorted(versions, key=_version_key, reverse=True)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise RegistryError(f"Module {namespace}/{name}/{provider} not found in registry.")
        raise RegistryError(f"Registry API error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise RegistryError(f"Failed to connect to registry: {e}")


def get_download_url(namespace: str, name: str, provider: str, version: str) -> str:
    """Get the source download URL for a specific module version."""
    url = f"{REGISTRY_BASE}/{namespace}/{name}/{provider}/{version}/download"
    try:
        resp = httpx.get(url, timeout=10, follow_redirects=False)
        # The registry returns a 204 with X-Terraform-Get header
        if resp.status_code == 204:
            source = resp.headers.get("X-Terraform-Get", "")
            if source:
                return source
        # Some registries return 301/302
        if resp.status_code in (301, 302):
            return resp.headers.get("Location", "")
        raise RegistryError(f"Unexpected response {resp.status_code} from download endpoint.")
    except httpx.RequestError as e:
        raise RegistryError(f"Failed to fetch download URL: {e}")


def get_module_info(namespace: str, name: str, provider: str) -> dict:
    """Fetch module metadata from the registry."""
    url = f"{REGISTRY_BASE}/{namespace}/{name}/{provider}"
    try:
        resp = httpx.get(url, timeout=10, follow_redirects=True)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise RegistryError(f"Module not found: {e.response.status_code}")
    except httpx.RequestError as e:
        raise RegistryError(f"Registry connection error: {e}")


def _version_key(v: str) -> tuple:
    """Parse version string for sorting."""
    parts = v.replace("v", "").split(".")
    result = []
    for p in parts:
        try:
            result.append(int(p))
        except ValueError:
            result.append(0)
    return tuple(result)
