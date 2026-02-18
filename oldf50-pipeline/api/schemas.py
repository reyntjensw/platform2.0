"""Pydantic models for the pipeline API."""

from __future__ import annotations
from pydantic import BaseModel


class EnvironmentInfo(BaseModel):
    uuid: str
    name: str
    env_type: str
    cloud_provider: str
    region: str


class Credentials(BaseModel):
    aws_account_id: str | None = None
    aws_role_arn: str | None = None
    aws_external_id: str | None = None
    azure_subscription_id: str | None = None
    azure_tenant_id: str | None = None


class BackendConfig(BaseModel):
    type: str = "s3"
    bucket: str
    key: str
    region: str
    dynamodb_table: str


class ModuleSpec(BaseModel):
    resource_id: str
    resource_name: str
    module_key: str
    source: str
    source_ref: str
    variables: dict


class GitCredentialSpec(BaseModel):
    host: str
    token: str


class IRPayload(BaseModel):
    environment: EnvironmentInfo
    credentials: Credentials
    backend: BackendConfig
    tags: dict
    modules: list[ModuleSpec]
    git_credentials: list[GitCredentialSpec] = []
    callback_url: str


class JobResponse(BaseModel):
    job_id: str
    status: str


class ScanRequest(BaseModel):
    source_url: str
    source_ref: str
    source_subpath: str | None = None
    engine: str = "opentofu"
    git_token: str | None = None


class ScanResponse(BaseModel):
    status: str = "success"
    scan_duration_ms: int | None = None
    files_detected: list[str] = []
    terraform_version_constraint: str | None = None
    provider_requirements: dict = {}
    variables: list[dict] = []
    outputs: list[dict] = []
    error_type: str | None = None
    error_message: str | None = None


class RegistryVersionsRequest(BaseModel):
    namespace: str
    name: str
    provider: str


class RegistryVersionsResponse(BaseModel):
    versions: list[str] = []
    error: str | None = None


class RegistryDownloadRequest(BaseModel):
    namespace: str
    name: str
    provider: str
    version: str


class RegistryDownloadResponse(BaseModel):
    source_url: str | None = None
    error: str | None = None


class CallbackPayload(BaseModel):
    deployment_uuid: str
    status: str
    plan_output: str | None = None
    result: dict | None = None
