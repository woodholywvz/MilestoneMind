from __future__ import annotations

from app.assessment_types import KnowledgeDocument


RUBRIC_DOCUMENTS: tuple[KnowledgeDocument, ...] = (
    KnowledgeDocument(
        document_id="approval_full",
        title="Full Approval Rubric",
        text=(
            "Approve 10000 basis points only when the evidence package clearly shows final delivery, "
            "production-ready or accepted work, and corroborating artifacts such as invoices, screenshots, "
            "or deployment confirmations. Ambiguous or incomplete claims should not receive full approval."
        ),
    ),
    KnowledgeDocument(
        document_id="approval_partial",
        title="Partial Approval Rubric",
        text=(
            "Approve 7000 basis points when evidence is credible and materially supports completed work, "
            "but remaining uncertainty or missing corroboration prevents a full release. Partial approval "
            "is appropriate when the work appears substantially complete yet still lacks one or more decisive proofs."
        ),
    ),
    KnowledgeDocument(
        document_id="hold_rubric",
        title="Hold Rubric",
        text=(
            "Use hold when work appears plausible but evidence is incomplete, stale, contradictory, or lacks "
            "the attachment detail needed for confident payout. Hold is a non-terminal state used to request stronger proof."
        ),
    ),
    KnowledgeDocument(
        document_id="dispute_rubric",
        title="Dispute Rubric",
        text=(
            "Use dispute when evidence is missing, obviously placeholder in nature, inconsistent with the milestone, "
            "or indicative of fake or broken deliverables. Missing URI, missing hash, missing summary, or zero attachments "
            "are immediate dispute triggers."
        ),
    ),
    KnowledgeDocument(
        document_id="attachment_expectations",
        title="Attachment Expectations",
        text=(
            "High-quality evidence packages usually contain attachments that directly corroborate the milestone claim, "
            "for example production screenshots, PDF invoices, acceptance notes, release checklists, or deployment artifacts. "
            "Attachment analysis should consider whether the file content reinforces the written summary."
        ),
    ),
    KnowledgeDocument(
        document_id="semantic_alignment",
        title="Semantic Alignment Checks",
        text=(
            "Assessment should verify semantic alignment between the deal title, milestone title, evidence summary, "
            "and any retrieved attachment content. Strong evidence references the actual milestone outcome rather than "
            "generic work statements."
        ),
    ),
    KnowledgeDocument(
        document_id="suspicious_language",
        title="Suspicious Language",
        text=(
            "Suspicious evidence often contains placeholder or uncertainty markers such as todo, draft, later, wip, "
            "missing, broken, or fake. These markers should heavily reduce trust and often justify hold or dispute."
        ),
    ),
    KnowledgeDocument(
        document_id="strong_language",
        title="Strong Evidence Language",
        text=(
            "Strong evidence often contains concrete delivery markers such as final, delivered, production, accepted, "
            "complete, and invoice, especially when these markers are backed by attachments and milestone-specific details."
        ),
    ),
)
