"""Service-to-service authentication via X-Service-Token header."""

import os
from fastapi import Header, HTTPException


SERVICE_TOKEN = os.environ.get("PIPELINE_SERVICE_TOKEN", "dev-token")


async def verify_service_token(x_service_token: str = Header(...)):
    if x_service_token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid service token")
