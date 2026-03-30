from __future__ import annotations

import hashlib
import json

from app.config import get_settings
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


def assess_submission(payload: AssessRequest) -> AssessResponse:
    settings = get_settings()

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
    rule_trace = [f"engine: {settings.assessment_engine_version} (deterministic rules path)"]

    missing_fields: list[str] = []
    if not normalized_uri:
        missing_fields.append("evidenceUri")
    if not normalized_hash_hex:
        missing_fields.append("evidenceHashHex")
    if not normalized_summary:
        missing_fields.append("evidenceSummary")

    if missing_fields:
        rule_trace.append("required-evidence: missing " + ", ".join(missing_fields))
        return _build_response(
            payload=payload,
            decision="dispute",
            approved_bps=0,
            confidence_bps=9_200,
            summary="Missing required evidence fields; manual review is required.",
            score=0,
            strong_matches=strong_matches,
            suspicious_matches=suspicious_matches,
            rule_trace=rule_trace,
            engine_version=settings.assessment_engine_version,
            normalized_summary=normalized_summary,
            normalized_hash_hex=normalized_hash_hex,
        )

    if not _is_sha256_hex(normalized_hash_hex):
        rule_trace.append("required-evidence: invalid evidenceHashHex format")
        return _build_response(
            payload=payload,
            decision="dispute",
            approved_bps=0,
            confidence_bps=9_000,
            summary="Evidence hash is missing or malformed; manual review is required.",
            score=0,
            strong_matches=strong_matches,
            suspicious_matches=suspicious_matches,
            rule_trace=rule_trace,
            engine_version=settings.assessment_engine_version,
            normalized_summary=normalized_summary,
            normalized_hash_hex=normalized_hash_hex,
        )

    if payload.attachment_count == 0:
        rule_trace.append("attachments: 0 -> immediate dispute")
        return _build_response(
            payload=payload,
            decision="dispute",
            approved_bps=0,
            confidence_bps=8_800,
            summary="Evidence package has no attachments; manual review is required.",
            score=0,
            strong_matches=strong_matches,
            suspicious_matches=suspicious_matches,
            rule_trace=rule_trace,
            engine_version=settings.assessment_engine_version,
            normalized_summary=normalized_summary,
            normalized_hash_hex=normalized_hash_hex,
        )

    summary_score = min(40, len(normalized_summary) // 3)
    attachment_score = min(20, payload.attachment_count * 5)
    strong_score = min(30, len(strong_matches) * 15)
    suspicious_penalty = len(suspicious_matches) * 25
    score = max(
        0,
        min(100, summary_score + attachment_score + strong_score - suspicious_penalty),
    )

    rule_trace.append(f"summary-length: {len(normalized_summary)} chars -> +{summary_score}")
    rule_trace.append(f"attachments: {payload.attachment_count} -> +{attachment_score}")
    rule_trace.append(
        "strong-keywords: "
        + (", ".join(strong_matches) if strong_matches else "none")
        + f" -> +{strong_score}"
    )
    rule_trace.append(
        "suspicious-keywords: "
        + (", ".join(suspicious_matches) if suspicious_matches else "none")
        + f" -> -{suspicious_penalty}"
    )
    rule_trace.append(f"score: {score}")

    confidence_signal = (
        min(2_500, len(normalized_summary) * 20)
        + min(1_500, payload.attachment_count * 300)
        + (len(strong_matches) * 350)
        + (len(suspicious_matches) * 250)
    )
    confidence_bps = max(3_500, min(9_800, 3_500 + confidence_signal))

    if score >= 85:
        decision = "approve"
        approved_bps = 10_000
        summary = "Evidence package is strong and supports a full approval."
    elif score >= 70:
        decision = "approve"
        approved_bps = 7_000
        summary = "Evidence is credible but better supports a partial approval."
    elif score >= 50:
        decision = "hold"
        approved_bps = 0
        summary = "Evidence is present but incomplete; additional support is needed."
    else:
        decision = "dispute"
        approved_bps = 0
        summary = "Evidence quality is too weak or too risky to approve."

    rule_trace.append(
        f"decision: {decision} with approvedBps={approved_bps} and confidenceBps={confidence_bps}"
    )

    return _build_response(
        payload=payload,
        decision=decision,
        approved_bps=approved_bps,
        confidence_bps=confidence_bps,
        summary=summary,
        score=score,
        strong_matches=strong_matches,
        suspicious_matches=suspicious_matches,
        rule_trace=rule_trace,
        engine_version=settings.assessment_engine_version,
        normalized_summary=normalized_summary,
        normalized_hash_hex=normalized_hash_hex,
    )


def _build_response(
    *,
    payload: AssessRequest,
    decision: str,
    approved_bps: int,
    confidence_bps: int,
    summary: str,
    score: int,
    strong_matches: list[str],
    suspicious_matches: list[str],
    rule_trace: list[str],
    engine_version: str,
    normalized_summary: str,
    normalized_hash_hex: str,
) -> AssessResponse:
    internal_decision_object = {
        "approvedBps": approved_bps,
        "attachmentCount": payload.attachment_count,
        "confidenceBps": confidence_bps,
        "decision": decision,
        "engineVersion": engine_version,
        "milestoneIndex": payload.milestone_index,
        "normalizedSummary": normalized_summary,
        "rationaleSignals": {
            "strongKeywords": strong_matches,
            "suspiciousKeywords": suspicious_matches,
        },
        "score": score,
        "summary": summary,
        "summaryLength": len(normalized_summary),
        "evidenceHashHex": normalized_hash_hex,
    }
    rationale_hash_hex = hashlib.sha256(
        _canonical_json(internal_decision_object).encode("utf-8")
    ).hexdigest()

    return AssessResponse(
        decision=decision,
        confidenceBps=confidence_bps,
        approvedBps=approved_bps,
        summary=summary,
        rationaleHashHex=rationale_hash_hex,
        ruleTrace=rule_trace,
        engineVersion=engine_version,
    )


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
