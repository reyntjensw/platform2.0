"""FactorFifty Pipeline Service — FastAPI app."""

from fastapi import FastAPI, Depends
from api.auth import verify_service_token
from api.schemas import (
    IRPayload, JobResponse,
    ScanRequest, ScanResponse,
    RegistryVersionsRequest, RegistryVersionsResponse,
    RegistryDownloadRequest, RegistryDownloadResponse,
)

app = FastAPI(title="F50 Pipeline", version="0.2.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/jobs/plan", response_model=JobResponse, dependencies=[Depends(verify_service_token)])
async def plan(payload: IRPayload):
    """Dispatch an async plan job."""
    from workers.plan_task import run_plan

    task = run_plan.delay(payload.model_dump())
    return JobResponse(job_id=task.id, status="dispatched")


@app.post("/jobs/deploy", response_model=JobResponse, dependencies=[Depends(verify_service_token)])
async def deploy(payload: IRPayload):
    """Dispatch an async deploy job."""
    from workers.deploy_task import run_deploy

    task = run_deploy.delay(payload.model_dump())
    return JobResponse(job_id=task.id, status="dispatched")


@app.post("/scan", response_model=ScanResponse, dependencies=[Depends(verify_service_token)])
async def scan(request: ScanRequest):
    """Synchronous scan of a module source to discover variables and outputs."""
    from scanners.tf_scanner import scan_module

    result = scan_module(
        source_url=request.source_url,
        source_ref=request.source_ref,
        source_subpath=request.source_subpath,
        engine=request.engine,
        git_token=request.git_token,
    )
    return ScanResponse(**result)


@app.post("/registry/versions", response_model=RegistryVersionsResponse, dependencies=[Depends(verify_service_token)])
async def registry_versions(request: RegistryVersionsRequest):
    """Fetch available versions for a Terraform Registry module."""
    from scanners.registry_client import list_versions, RegistryError

    try:
        versions = list_versions(request.namespace, request.name, request.provider)
        return RegistryVersionsResponse(versions=versions)
    except RegistryError as e:
        return RegistryVersionsResponse(error=str(e))


@app.post("/registry/download", response_model=RegistryDownloadResponse, dependencies=[Depends(verify_service_token)])
async def registry_download(request: RegistryDownloadRequest):
    """Get the source download URL for a Terraform Registry module version."""
    from scanners.registry_client import get_download_url, RegistryError

    try:
        url = get_download_url(request.namespace, request.name, request.provider, request.version)
        return RegistryDownloadResponse(source_url=url)
    except RegistryError as e:
        return RegistryDownloadResponse(error=str(e))
