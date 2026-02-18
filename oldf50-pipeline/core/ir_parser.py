"""Parse IR JSON into typed dataclasses for the generator."""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Environment:
    uuid: str
    name: str
    env_type: str
    cloud_provider: str
    region: str


@dataclass
class Credentials:
    aws_account_id: str | None = None
    aws_role_arn: str | None = None
    aws_external_id: str | None = None


@dataclass
class Backend:
    type: str
    bucket: str
    key: str
    region: str
    dynamodb_table: str


@dataclass
class Module:
    resource_id: str
    resource_name: str
    module_key: str
    source: str
    source_ref: str
    variables: dict = field(default_factory=dict)


@dataclass
class GitCredential:
    host: str
    token: str


@dataclass
class IR:
    environment: Environment
    credentials: Credentials
    backend: Backend
    tags: dict
    modules: list[Module]
    git_credentials: list[GitCredential]
    callback_url: str


def parse_ir(data: dict) -> IR:
    """Parse a raw IR dict into typed dataclasses."""
    return IR(
        environment=Environment(**data["environment"]),
        credentials=Credentials(**{k: v for k, v in data["credentials"].items() if v is not None}),
        backend=Backend(**data["backend"]),
        tags=data.get("tags", {}),
        modules=[Module(**m) for m in data["modules"]],
        git_credentials=[GitCredential(**g) for g in data.get("git_credentials", [])],
        callback_url=data["callback_url"],
    )
