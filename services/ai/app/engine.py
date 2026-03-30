from __future__ import annotations

import hashlib
import json
from typing import Any

from app.assessment_types import AssessmentDecision, AssessmentLayerResult
from app.config import AISettings, get_settings
from app.openai_layer import assess_with_openai
from app.schemas import AssessRequest, AssessResponse

SUSPICIOUS_KEYWORDS = ("todo", "draft", "later", "wip", "missing", "broken", "fake")
STRONG_EVIDENCE_KEYWORDS = (
    "final",
    "delivered",
    "production",
    "accepted",
    "complete",
    "invoice",
)
DECISION_SEVERITY: dict[AssessmentDecision, int] = {
    "approve": 0,
    "hold": 1,
    "dispute": 2,
}


def assess_submission(payload: AssessRequest) -> AssessResponse:
    settings = get_settings()
    rules_result = assess_with_rules(payload, settings)

    semantic_result: AssessmentLayerResult | None = None
    if rules_result.hard_block:
        rules_result.trace.append("openai: skipped because deterministic hard block already failed")
    elif settings.enable_llm and settings.openai_api_key:
        try:
            semantic_result = assess_with_openai(
                payload=payload,
                rules_result=rules_result,
                settings=settings,
            )
        except Exception as exc:  # noqa: BLE001
            rules_result.trace.append(
                f"openai: semantic layer failed with {type(exc).__name__}; falling back to rules-only result"
            )
    elif settings.enable_llm and not settings.openai_api_key:
        rules_result.trace.append(
            "openai: AI_ENABLE_LLM=1 but OPENAI_API_KEY is missing; using rules-only result"
        )

    final_result = synthesize_results(
        payload=payload,
        rules_result=rules_result,
        semantic_result=semantic_result,
        settings=settings,
    )
    rationale_hash_hex = build_rationale_hash(
        payload=payload,
        rules_result=rules_result,
        semantic_result=semantic_result,
        final_result=final_result,
    )

    return AssessResponse(
        decision=final_result.decision,
        confidenceBps=final_result.confidence_bps,
        approvedBps=final_result.approved_bps,
        summary=final_result.summary,
        rationaleHashHex=rationale_hash_hex,
        ruleTrace=final_result.trace,
        engineVersion=final_result.engine_version,
    )


def assess_with_rules(payload: AssessRequest, settings: AISettings) -> AssessmentLayerResult:
    normalized_summary = _normalize_text(payload.evidence_summary)
    normalized_uri = payload.evidence_uri.strip()
    normalized_hash_hex = payload.evidence_hash_hex.strip().lower().removeprefix("0x")
    normalized_context = _normalize_text(
        payload.deal_title,
        payload.milestone_title,
        payload.evidence_summary,
        payload.evidence_uri,
    )
    strong_matches = _find_keywords(normalized_context, STRONG_EVIDENCE_KEYWORDS)
    suspicious_matches = _find_keywords(normalized_context, SUSPICIOUS_KEYWORDS)
    trace = [f"engine: {settings.assessment_engine_version} (deterministic rules path)"]

    missing_fields: list[str] = []
    if not normalized_uri:
        missing_fields.append("evidenceUri")
    if not normalized_hash_hex:
        missing_fields.append("evidenceHashHex")
    if not normalized_summary:
        missing_fields.append("evidenceSummary")

    if missing_fields:
        trace.append("required-evidence: missing " + ", ".join(missing_fields))
        return AssessmentLayerResult(
            layer="rules",
            decision="dispute",
            approved_bps=0,
            confidence_bps=9_200,
            summary="Missing required evidence fields; manual review is required.",
            score=0,
            trace=trace,
            engine_version=settings.assessment_engine_version,
            hard_block=True,
            metadata={
                "missing_fields": missing_fields,
                "strong_matches": strong_matches,
                "suspicious_matches": suspicious_matches,
            },
        )

    if not _is_sha256_hex(normalized_hash_hex):
        trace.append("required-evidence: invalid evidenceHashHex format")
        return AssessmentLayerResult(
            layer="rules",
            decision="dispute",
            approved_bps=0,
            confidence_bps=9_000,
            summary="Evidence hash is missing or malformed; manual review is required.",
            score=0,
            trace=trace,
            engine_version=settings.assessment_engine_version,
            hard_block=True,
            metadata={
                "strong_matches": strong_matches,
                "suspicious_matches": suspicious_matches,
            },
        )

    if payload.attachment_count == 0:
        trace.append("attachments: 0 -> immediate dispute")
        return AssessmentLayerResult(
            layer="rules",
            decision="dispute",
            approved_bps=0,
            confidence_bps=8_800,
            summary="Evidence package has no attachments; manual review is required.",
            score=0,
            trace=trace,
            engine_version=settings.assessment_engine_version,
            hard_block=True,
            metadata={
                "strong_matches": strong_matches,
                "suspicious_matches": suspicious_matches,
            },
        )

    summary_score = min(40, len(normalized_summary) // 3)
    attachment_score = min(20, payload.attachment_count * 5)
    strong_score = min(30, len(strong_matches) * 15)
    suspicious_penalty = len(suspicious_matches) * 25
    score = max(
        0,
        min(100, summary_score + attachment_score + strong_score - suspicious_penalty),
    )

    trace.append(f"summary-length: {len(normalized_summary)} chars -> +{summary_score}")
    trace.append(f"attachments: {payload.attachment_count} -> +{attachment_score}")
    trace.append(
        "strong-keywords: "
        + (", ".join(strong_matches) if strong_matches else "none")
        + f" -> +{strong_score}"
    )
    trace.append(
        "suspicious-keywords: "
        + (", ".join(suspicious_matches) if suspicious_matches else "none")
        + f" -> -{suspicious_penalty}"
    )
    trace.append(f"score: {score}")

    confidence_signal = (
        min(2_500, len(normalized_summary) * 20)
        + min(1_500, payload.attachment_count * 300)
        + (len(strong_matches) * 350)
        + (len(suspicious_matches) * 250)
    )
    confidence_bps = max(3_500, min(9_800, 3_500 + confidence_signal))

    decision, approved_bps, summary = _decision_from_score(score)
    trace.append(
        f"decision: {decision} with approvedBps={approved_bps} and confidenceBps={confidence_bps}"
    )

    return AssessmentLayerResult(
        layer="rules",
        decision=decision,
        approved_bps=approved_bps,
        confidence_bps=confidence_bps,
        summary=summary,
        score=score,
        trace=trace,
        engine_version=settings.assessment_engine_version,
        metadata={
            "normalized_summary": normalized_summary,
            "normalized_hash_hex": normalized_hash_hex,
            "strong_matches": strong_matches,
            "suspicious_matches": suspicious_matches,
        },
    )


def synthesize_results(
    *,
    payload: AssessRequest,
    rules_result: AssessmentLayerResult,
    semantic_result: AssessmentLayerResult | None,
    settings: AISettings,
) -> AssessmentLayerResult:
    if semantic_result is None:
        return rules_result

    rag_score = int(semantic_result.metadata.get("rag_score", 0))
    combined_score = round(
        (rules_result.score * 0.45)
        + (semantic_result.score * 0.40)
        + (rag_score * 0.15)
    )
    mapped_decision, mapped_approved_bps, mapped_summary = _decision_from_score(combined_score)

    final_decision = _stricter_decision(
        mapped_decision,
        semantic_result.decision,
    )
    final_decision = _stricter_decision(final_decision, rules_result.decision)

    if final_decision == "approve":
        final_approved_bps = min(
            mapped_approved_bps,
            rules_result.approved_bps,
            semantic_result.approved_bps,
        )
    else:
        final_approved_bps = 0

    final_confidence = round(
        (rules_result.confidence_bps * 0.35)
        + (semantic_result.confidence_bps * 0.55)
        + (rag_score * 10)
    )
    final_confidence = max(0, min(10_000, final_confidence))

    final_summary = semantic_result.summary.strip() or mapped_summary
    if final_decision != semantic_result.decision:
        final_summary = (
            semantic_result.summary.strip()
            + " Deterministic guardrails kept the more conservative final outcome."
        ).strip()

    trace = [
        *rules_result.trace,
        *semantic_result.trace,
        (
            "synthesis: combined score="
            f"{combined_score} from rules={rules_result.score}, semantic={semantic_result.score}, rag={rag_score}"
        ),
        (
            "synthesis: final decision="
            f"{final_decision} approvedBps={final_approved_bps} confidenceBps={final_confidence}"
        ),
    ]
    return AssessmentLayerResult(
        layer="final",
        decision=final_decision,
        approved_bps=final_approved_bps,
        confidence_bps=final_confidence,
        summary=final_summary,
        score=combined_score,
        trace=trace,
        engine_version=f"{settings.assessment_engine_version}+openai-v1",
        metadata={
            "rules_decision": rules_result.decision,
            "semantic_decision": semantic_result.decision,
            "mapped_decision": mapped_decision,
            "payload_milestone_pubkey": payload.milestone_pubkey,
        },
    )


def build_rationale_hash(
    *,
    payload: AssessRequest,
    rules_result: AssessmentLayerResult,
    semantic_result: AssessmentLayerResult | None,
    final_result: AssessmentLayerResult,
) -> str:
    internal_decision_object = {
        "payload": {
            "dealPubkey": payload.deal_pubkey,
            "milestonePubkey": payload.milestone_pubkey,
            "milestoneIndex": payload.milestone_index,
            "dealTitle": _normalize_text(payload.deal_title),
            "milestoneTitle": _normalize_text(payload.milestone_title),
            "milestoneAmount": payload.milestone_amount,
            "evidenceUri": payload.evidence_uri.strip(),
            "evidenceHashHex": payload.evidence_hash_hex.strip().lower().removeprefix("0x"),
            "evidenceSummary": _normalize_text(payload.evidence_summary),
            "attachmentCount": payload.attachment_count,
        },
        "rules": _serialize_layer_result(rules_result),
        "semantic": _serialize_layer_result(semantic_result),
        "final": _serialize_layer_result(final_result),
    }
    return hashlib.sha256(
        _canonical_json(internal_decision_object).encode("utf-8")
    ).hexdigest()


def _serialize_layer_result(
    layer_result: AssessmentLayerResult | None,
) -> dict[str, Any] | None:
    if layer_result is None:
        return None

    return {
        "layer": layer_result.layer,
        "decision": layer_result.decision,
        "approvedBps": layer_result.approved_bps,
        "confidenceBps": layer_result.confidence_bps,
        "summary": layer_result.summary,
        "score": layer_result.score,
        "engineVersion": layer_result.engine_version,
        "hardBlock": layer_result.hard_block,
        "trace": layer_result.trace,
        "metadata": layer_result.metadata,
    }


def _decision_from_score(score: int) -> tuple[AssessmentDecision, int, str]:
    if score >= 85:
        return "approve", 10_000, "Evidence package is strong and supports a full approval."
    if score >= 70:
        return "approve", 7_000, "Evidence is credible but better supports a partial approval."
    if score >= 50:
        return "hold", 0, "Evidence is present but incomplete; additional support is needed."
    return "dispute", 0, "Evidence quality is too weak or too risky to approve."


def _stricter_decision(
    left: AssessmentDecision,
    right: AssessmentDecision,
) -> AssessmentDecision:
    if DECISION_SEVERITY[left] >= DECISION_SEVERITY[right]:
        return left
    return right


def _normalize_text(*parts: str) -> str:
    return " ".join(" ".join(part.strip().lower().split()) for part in parts if part).strip()


def _find_keywords(text: str, keywords: tuple[str, ...]) -> list[str]:
    return sorted({keyword for keyword in keywords if keyword in text})


def _canonical_json(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _is_sha256_hex(value: str) -> bool:
    if len(value) != 64:
        return False
    return all(character in "0123456789abcdef" for character in value)
