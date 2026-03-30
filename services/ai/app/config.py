from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AISettings:
    assessment_engine_version: str
    enable_llm: bool


def get_settings() -> AISettings:
    return AISettings(
        assessment_engine_version=os.getenv("AI_ASSESSMENT_ENGINE_VERSION", "rules-v1"),
        enable_llm=os.getenv("AI_ENABLE_LLM", "0").strip().lower() in {"1", "true", "yes", "on"},
    )
