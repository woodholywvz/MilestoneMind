from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


AssessmentDecision = Literal["approve", "hold", "dispute"]


@dataclass
class AssessmentLayerResult:
    layer: str
    decision: AssessmentDecision
    approved_bps: int
    confidence_bps: int
    summary: str
    score: int
    trace: list[str]
    engine_version: str
    hard_block: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AttachmentArtifact:
    kind: str
    source_url: str
    filename: str | None
    preview_text: str | None = None
    input_item: dict[str, Any] | None = None


@dataclass(frozen=True)
class KnowledgeDocument:
    document_id: str
    title: str
    text: str


@dataclass(frozen=True)
class KnowledgeMatch:
    document_id: str
    title: str
    similarity: float
    excerpt: str
