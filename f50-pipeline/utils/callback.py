"""POST results back to Rails callback URL."""

from __future__ import annotations
import logging
import httpx
import os

logger = logging.getLogger(__name__)

SERVICE_TOKEN = os.environ.get("PIPELINE_SERVICE_TOKEN", "dev-token")


def send_callback(callback_url: str, payload: dict) -> bool:
    """Send callback to Rails with deployment results."""
    try:
        resp = httpx.post(
            callback_url,
            json=payload,
            headers={"X-Service-Token": SERVICE_TOKEN, "Content-Type": "application/json"},
            timeout=30.0,
        )
        logger.info(f"Callback to {callback_url}: {resp.status_code}")
        return resp.is_success
    except Exception as e:
        logger.error(f"Callback failed: {e}")
        return False
