from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


AssessmentDecision = Literal["approve", "hold", "dispute"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["ai"]


class AssessRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    deal_pubkey: str = Field(alias="dealPubkey")
    milestone_pubkey: str = Field(alias="milestonePubkey")
    milestone_index: int = Field(alias="milestoneIndex", ge=0)
    deal_title: str = Field(alias="dealTitle")
    milestone_title: str = Field(alias="milestoneTitle")
    milestone_amount: int = Field(alias="milestoneAmount", ge=0)
    evidence_uri: str = Field(alias="evidenceUri")
    evidence_hash_hex: str = Field(alias="evidenceHashHex")
    evidence_summary: str = Field(alias="evidenceSummary")
    attachment_count: int = Field(alias="attachmentCount", ge=0)


class AssessResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    decision: AssessmentDecision
    confidence_bps: int = Field(alias="confidenceBps", ge=0, le=10_000)
    approved_bps: int = Field(alias="approvedBps", ge=0, le=10_000)
    summary: str
    rationale_hash_hex: str = Field(alias="rationaleHashHex")
    rule_trace: list[str] = Field(alias="ruleTrace")
    engine_version: str = Field(alias="engineVersion")
