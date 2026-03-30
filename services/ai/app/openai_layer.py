from __future__ import annotations

import base64
import mimetypes
import re
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urlparse

import httpx
from openai import OpenAI
from pydantic import BaseModel, Field

from app.assessment_types import (
    AssessmentDecision,
    AssessmentLayerResult,
    AttachmentArtifact,
    KnowledgeDocument,
    KnowledgeMatch,
)
from app.config import AISettings
from app.knowledge_base import RUBRIC_DOCUMENTS
from app.schemas import AssessRequest

_EMBEDDING_CACHE: dict[str, list[list[float]]] = {}


class SemanticAssessmentOutput(BaseModel):
    decision: AssessmentDecision
    approved_bps: int = Field(ge=0, le=10_000)
    confidence_bps: int = Field(ge=0, le=10_000)
    semantic_score: int = Field(ge=0, le=100)
    summary: str
    semantic_findings: list[str]
    risk_flags: list[str]
    attachment_findings: list[str]
    cited_rule_ids: list[str]


def assess_with_openai(
    payload: AssessRequest,
    rules_result: AssessmentLayerResult,
    settings: AISettings,
    client: OpenAI | None = None,
) -> AssessmentLayerResult:
    openai_client = client or _build_client(settings)
    trace = [
        f"openai: model={settings.openai_model} reasoning={settings.openai_reasoning_effort}",
        f"openai: embeddings={settings.openai_embedding_model}",
    ]

    try:
        knowledge_matches = _rank_knowledge_documents(
            openai_client=openai_client,
            payload=payload,
            rules_result=rules_result,
            settings=settings,
        )
        if knowledge_matches:
            for match in knowledge_matches:
                trace.append(
                    f"rag: {match.document_id} similarity={match.similarity:.3f} title={match.title}"
                )
        else:
            trace.append("rag: no knowledge matches available")
    except Exception as exc:  # noqa: BLE001
        knowledge_matches = []
        trace.append(f"rag: retrieval failed with {type(exc).__name__}; continuing without embeddings")

    attachment_artifacts, attachment_trace = collect_attachment_artifacts(
        payload.evidence_uri,
        settings,
    )
    trace.extend(attachment_trace)

    response = openai_client.responses.parse(
        model=settings.openai_model,
        input=_build_messages(
            payload=payload,
            rules_result=rules_result,
            knowledge_matches=knowledge_matches,
            attachment_artifacts=attachment_artifacts,
        ),
        reasoning={"effort": settings.openai_reasoning_effort},
        max_output_tokens=900,
        text_format=SemanticAssessmentOutput,
    )
    parsed = cast(SemanticAssessmentOutput | None, response.output_parsed)
    if parsed is None:
        raise RuntimeError("OpenAI semantic assessment returned no structured payload.")

    trace.append(
        f"semantic: decision={parsed.decision} approvedBps={parsed.approved_bps} "
        f"confidenceBps={parsed.confidence_bps} semanticScore={parsed.semantic_score}"
    )
    for finding in parsed.semantic_findings:
        trace.append(f"semantic-finding: {finding}")
    for finding in parsed.attachment_findings:
        trace.append(f"attachment-finding: {finding}")
    for risk in parsed.risk_flags:
        trace.append(f"risk-flag: {risk}")

    rag_score = _rag_support_score(knowledge_matches)
    return AssessmentLayerResult(
        layer="semantic",
        decision=parsed.decision,
        approved_bps=parsed.approved_bps,
        confidence_bps=parsed.confidence_bps,
        summary=parsed.summary.strip(),
        score=parsed.semantic_score,
        trace=trace,
        engine_version="openai-v1",
        metadata={
            "rag_score": rag_score,
            "knowledge_matches": [
                {
                    "document_id": match.document_id,
                    "title": match.title,
                    "similarity": round(match.similarity, 6),
                    "excerpt": match.excerpt,
                }
                for match in knowledge_matches
            ],
            "semantic_findings": parsed.semantic_findings,
            "risk_flags": parsed.risk_flags,
            "attachment_findings": parsed.attachment_findings,
            "cited_rule_ids": parsed.cited_rule_ids,
            "response_id": getattr(response, "id", None),
        },
    )


def collect_attachment_artifacts(
    evidence_uri: str,
    settings: AISettings,
) -> tuple[list[AttachmentArtifact], list[str]]:
    trace: list[str] = []
    resolved_uri = _resolve_evidence_uri(evidence_uri, settings)
    if not resolved_uri:
        return [], ["attachment: no resolvable evidence URI"]

    parsed = urlparse(resolved_uri)
    trace.append(f"attachment: resolved URI -> {resolved_uri}")
    if parsed.scheme not in {"http", "https"}:
        trace.append(f"attachment: unsupported URI scheme {parsed.scheme or 'unknown'}")
        return [], trace

    try:
        with httpx.Client(
            timeout=settings.openai_timeout_seconds,
            follow_redirects=True,
        ) as http_client:
            with http_client.stream("GET", resolved_uri) as response:
                response.raise_for_status()
                content_type = _normalize_content_type(
                    response.headers.get("content-type"),
                    resolved_uri,
                )
                filename = _filename_from_response(response, resolved_uri)
                body, truncated = _read_limited_body(
                    response=response,
                    max_bytes=settings.max_attachment_bytes,
                )

        if content_type.startswith("image/"):
            data_url = (
                f"data:{content_type};base64,{base64.b64encode(body).decode('ascii')}"
            )
            trace.append(
                f"attachment: image fetched contentType={content_type} bytes={len(body)}"
            )
            if truncated:
                trace.append("attachment: image truncated to byte limit before model input")
            return [
                AttachmentArtifact(
                    kind="image",
                    source_url=resolved_uri,
                    filename=filename,
                    input_item={
                        "type": "input_image",
                        "image_url": data_url,
                        "detail": "high",
                    },
                )
            ], trace

        if content_type == "application/pdf":
            trace.append(
                f"attachment: pdf fetched contentType={content_type} bytes={len(body)}"
            )
            if truncated:
                trace.append("attachment: pdf truncated to byte limit before model input")
            return [
                AttachmentArtifact(
                    kind="pdf",
                    source_url=resolved_uri,
                    filename=filename or "attachment.pdf",
                    input_item={
                        "type": "input_file",
                        "filename": filename or "attachment.pdf",
                        "file_data": base64.b64encode(body).decode("ascii"),
                    },
                )
            ], trace

        preview_text = _extract_text_preview(body, content_type)
        trace.append(
            f"attachment: text-like preview prepared contentType={content_type} chars={len(preview_text)}"
        )
        if truncated:
            trace.append("attachment: text preview truncated to byte limit")
        return [
            AttachmentArtifact(
                kind="text",
                source_url=resolved_uri,
                filename=filename,
                preview_text=preview_text,
            )
        ], trace
    except Exception as exc:  # noqa: BLE001
        trace.append(f"attachment: fetch failed with {type(exc).__name__}")
        return [], trace


def _build_messages(
    *,
    payload: AssessRequest,
    rules_result: AssessmentLayerResult,
    knowledge_matches: list[KnowledgeMatch],
    attachment_artifacts: list[AttachmentArtifact],
) -> list[dict[str, Any]]:
    developer_text = (
        "You are MilestoneMind's semantic assessment layer. "
        "You sit on top of a deterministic payout rules engine, so your job is to provide a conservative, "
        "semantically grounded assessment using the milestone context, the written evidence, and any attachment content. "
        "Use the retrieved rubric excerpts as hard guidance. "
        "Approve 10000 only when the evidence clearly supports full completion and corroborates the claim. "
        "Approve 7000 only when the evidence is credible but still partially incomplete. "
        "Use hold when the claim may be valid but requires stronger proof. "
        "Use dispute when the evidence conflicts with the milestone, looks fake, or misses critical proof. "
        "Do not invent attachment details that are not present in the inputs."
    )
    user_sections = [
        "Assessment payload:",
        f"- deal_pubkey: {payload.deal_pubkey}",
        f"- milestone_pubkey: {payload.milestone_pubkey}",
        f"- milestone_index: {payload.milestone_index}",
        f"- deal_title: {payload.deal_title}",
        f"- milestone_title: {payload.milestone_title}",
        f"- milestone_amount: {payload.milestone_amount}",
        f"- evidence_uri: {payload.evidence_uri}",
        f"- evidence_hash_hex: {payload.evidence_hash_hex}",
        f"- evidence_summary: {payload.evidence_summary}",
        f"- attachment_count: {payload.attachment_count}",
        "",
        "Deterministic guardrail:",
        f"- decision: {rules_result.decision}",
        f"- approved_bps: {rules_result.approved_bps}",
        f"- confidence_bps: {rules_result.confidence_bps}",
        f"- score: {rules_result.score}",
        f"- summary: {rules_result.summary}",
        "- trace:",
        *[f"  - {item}" for item in rules_result.trace[-6:]],
    ]

    if knowledge_matches:
        user_sections.extend(["", "Retrieved rubric excerpts:"])
        for match in knowledge_matches:
            user_sections.append(
                f"- [{match.document_id}] similarity={match.similarity:.3f} {match.title}: {match.excerpt}"
            )

    for artifact in attachment_artifacts:
        if artifact.preview_text:
            user_sections.extend(
                [
                    "",
                    f"Attachment preview from {artifact.source_url}:",
                    artifact.preview_text,
                ]
            )

    content: list[dict[str, Any]] = [
        {"type": "input_text", "text": "\n".join(user_sections)},
    ]
    for artifact in attachment_artifacts:
        if artifact.input_item is not None:
            content.append(artifact.input_item)

    return [
        {
            "role": "developer",
            "content": [{"type": "input_text", "text": developer_text}],
        },
        {
            "role": "user",
            "content": content,
        },
    ]


def _rank_knowledge_documents(
    *,
    openai_client: OpenAI,
    payload: AssessRequest,
    rules_result: AssessmentLayerResult,
    settings: AISettings,
) -> list[KnowledgeMatch]:
    documents = list(RUBRIC_DOCUMENTS)
    if not documents:
        return []

    query_text = "\n".join(
        [
            payload.deal_title,
            payload.milestone_title,
            payload.evidence_summary,
            payload.evidence_uri,
            f"attachments={payload.attachment_count}",
            f"rules_decision={rules_result.decision}",
            f"rules_summary={rules_result.summary}",
        ]
    )
    document_vectors = _get_document_embeddings(
        client=openai_client,
        settings=settings,
        documents=documents,
    )
    query_vector = _embed_text(
        client=openai_client,
        model=settings.openai_embedding_model,
        text=query_text,
    )

    matches = [
        KnowledgeMatch(
            document_id=document.document_id,
            title=document.title,
            similarity=_cosine_similarity(query_vector, vector),
            excerpt=_excerpt(document.text),
        )
        for document, vector in zip(documents, document_vectors, strict=True)
    ]
    matches.sort(key=lambda item: item.similarity, reverse=True)
    return matches[: settings.rag_top_k]


def _get_document_embeddings(
    *,
    client: OpenAI,
    settings: AISettings,
    documents: list[KnowledgeDocument],
) -> list[list[float]]:
    cache_key = settings.openai_embedding_model
    if cache_key in _EMBEDDING_CACHE:
        return _EMBEDDING_CACHE[cache_key]

    response = client.embeddings.create(
        model=settings.openai_embedding_model,
        input=[document.text for document in documents],
    )
    vectors = [list(item.embedding) for item in response.data]
    _EMBEDDING_CACHE[cache_key] = vectors
    return vectors


def _embed_text(*, client: OpenAI, model: str, text: str) -> list[float]:
    response = client.embeddings.create(model=model, input=text)
    return list(response.data[0].embedding)


def _build_client(settings: AISettings) -> OpenAI:
    client_kwargs: dict[str, Any] = {
        "api_key": settings.openai_api_key,
        "timeout": settings.openai_timeout_seconds,
    }
    if settings.openai_base_url:
        client_kwargs["base_url"] = settings.openai_base_url
    return OpenAI(**client_kwargs)


def _resolve_evidence_uri(evidence_uri: str, settings: AISettings) -> str:
    stripped = evidence_uri.strip()
    if not stripped:
        return ""
    if stripped.startswith("ipfs://"):
        path = stripped.removeprefix("ipfs://").lstrip("/")
        return settings.ipfs_gateway_base + path
    return stripped


def _normalize_content_type(raw_content_type: str | None, resolved_uri: str) -> str:
    if raw_content_type:
        return raw_content_type.split(";", 1)[0].strip().lower()
    guessed, _ = mimetypes.guess_type(resolved_uri)
    return guessed or "text/plain"


def _filename_from_response(response: httpx.Response, resolved_uri: str) -> str | None:
    content_disposition = response.headers.get("content-disposition", "")
    match = re.search(r'filename="?([^";]+)"?', content_disposition)
    if match:
        return match.group(1)

    path = PurePosixPath(urlparse(resolved_uri).path)
    return path.name or None


def _read_limited_body(
    *,
    response: httpx.Response,
    max_bytes: int,
) -> tuple[bytes, bool]:
    chunks = bytearray()
    truncated = False
    for chunk in response.iter_bytes():
        remaining = max_bytes - len(chunks)
        if remaining <= 0:
            truncated = True
            break
        if len(chunk) > remaining:
            chunks.extend(chunk[:remaining])
            truncated = True
            break
        chunks.extend(chunk)
    return bytes(chunks), truncated


def _extract_text_preview(body: bytes, content_type: str) -> str:
    decoded = body.decode("utf-8", errors="ignore")
    if content_type == "application/json":
        compact = re.sub(r"\s+", " ", decoded).strip()
        return compact[:4_000]

    without_tags = re.sub(r"<[^>]+>", " ", decoded)
    compact = re.sub(r"\s+", " ", without_tags).strip()
    return compact[:4_000]


def _excerpt(text: str) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    return compact[:220]


def _rag_support_score(matches: list[KnowledgeMatch]) -> int:
    if not matches:
        return 0
    average_similarity = sum(match.similarity for match in matches) / len(matches)
    return max(0, min(100, round(average_similarity * 100)))


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0

    dot_product = sum(left_value * right_value for left_value, right_value in zip(left, right, strict=True))
    left_norm = sum(value * value for value in left) ** 0.5
    right_norm = sum(value * value for value in right) ** 0.5
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot_product / (left_norm * right_norm)
