from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AISettings:
    assessment_engine_version: str
    enable_llm: bool
    openai_api_key: str | None
    openai_base_url: str | None
    openai_model: str
    openai_embedding_model: str
    openai_reasoning_effort: str
    openai_timeout_seconds: float
    rag_top_k: int
    max_attachment_bytes: int
    ipfs_gateway_base: str


def get_settings() -> AISettings:
    return AISettings(
        assessment_engine_version=os.getenv("AI_ASSESSMENT_ENGINE_VERSION", "rules-v1"),
        enable_llm=_get_bool("AI_ENABLE_LLM", False),
        openai_api_key=_get_optional("OPENAI_API_KEY"),
        openai_base_url=_get_optional("OPENAI_BASE_URL"),
        openai_model=os.getenv("AI_OPENAI_MODEL", "gpt-5.4-mini"),
        openai_embedding_model=os.getenv(
            "AI_OPENAI_EMBEDDING_MODEL",
            "text-embedding-3-small",
        ),
        openai_reasoning_effort=os.getenv(
            "AI_OPENAI_REASONING_EFFORT",
            "medium",
        ),
        openai_timeout_seconds=_get_float("AI_OPENAI_TIMEOUT_SECONDS", 45.0),
        rag_top_k=max(1, _get_int("AI_RAG_TOP_K", 4)),
        max_attachment_bytes=max(65_536, _get_int("AI_MAX_ATTACHMENT_BYTES", 2_000_000)),
        ipfs_gateway_base=_get_ipfs_gateway_base(),
    )


def _get_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _get_optional(name: str) -> str | None:
    raw_value = os.getenv(name)
    if raw_value is None:
        return None
    stripped = raw_value.strip()
    return stripped or None


def _get_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def _get_float(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return float(raw_value)
    except ValueError:
        return default


def _get_ipfs_gateway_base() -> str:
    base = os.getenv("AI_IPFS_GATEWAY", "https://ipfs.io/ipfs/").strip() or "https://ipfs.io/ipfs/"
    return base.rstrip("/") + "/"
