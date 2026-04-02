use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_EVIDENCE_SUMMARY_LEN, MAX_EVIDENCE_URI_LEN, MILESTONE_SEED},
    errors::MilestoneMindError,
    state::{Deal, DealStatus, Milestone, MilestoneStatus},
};

pub fn handler(
    ctx: Context<SubmitEvidence>,
    _milestone_index: u16,
    evidence_uri: String,
    evidence_hash: [u8; 32],
    evidence_summary: String,
    attachment_count: u16,
) -> Result<()> {
    validate_submission_payload(&evidence_uri, &evidence_summary, attachment_count)?;

    let deal_status = ctx.accounts.deal.status;
    let milestone_status = ctx.accounts.milestone.status;

    require!(
        can_submit_for_deal_status(deal_status),
        MilestoneMindError::InvalidEvidenceDealStatus
    );
    require!(
        can_submit_for_milestone_status(milestone_status),
        MilestoneMindError::InvalidEvidenceMilestoneStatus
    );

    let submitted_at = Clock::get()?.unix_timestamp;

    {
        let milestone = &mut ctx.accounts.milestone;
        milestone.evidence_uri = evidence_uri;
        milestone.evidence_hash = evidence_hash;
        milestone.evidence_summary = evidence_summary;
        milestone.attachment_count = attachment_count;
        milestone.last_submitted_at = submitted_at;
        milestone.status = MilestoneStatus::EvidenceSubmitted;
    }

    if matches!(deal_status, DealStatus::Funded) {
        ctx.accounts.deal.status = DealStatus::InProgress;
    }

    Ok(())
}

fn validate_submission_payload(
    evidence_uri: &str,
    evidence_summary: &str,
    attachment_count: u16,
) -> Result<()> {
    require!(
        !evidence_uri.trim().is_empty(),
        MilestoneMindError::EmptyEvidenceUri
    );
    require!(
        evidence_uri.len() <= MAX_EVIDENCE_URI_LEN,
        MilestoneMindError::EvidenceUriTooLong
    );
    require!(
        !evidence_summary.trim().is_empty(),
        MilestoneMindError::EmptyEvidenceSummary
    );
    require!(
        evidence_summary.len() <= MAX_EVIDENCE_SUMMARY_LEN,
        MilestoneMindError::EvidenceSummaryTooLong
    );
    require!(
        attachment_count > 0,
        MilestoneMindError::InvalidAttachmentCount
    );

    Ok(())
}

fn can_submit_for_deal_status(status: DealStatus) -> bool {
    matches!(status, DealStatus::Funded | DealStatus::InProgress)
}

fn can_submit_for_milestone_status(status: MilestoneStatus) -> bool {
    matches!(status, MilestoneStatus::PendingEvidence | MilestoneStatus::OnHold)
}

#[derive(Accounts)]
#[instruction(milestone_index: u16)]
pub struct SubmitEvidence<'info> {
    #[account(mut)]
    pub freelancer: Signer<'info>,
    #[account(
        mut,
        constraint = deal.freelancer == freelancer.key() @ MilestoneMindError::UnauthorizedFreelancer
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        mut,
        seeds = [MILESTONE_SEED, deal.key().as_ref(), milestone_index.to_le_bytes().as_ref()],
        bump = milestone.bump,
        constraint = milestone.deal == deal.key() @ MilestoneMindError::MilestoneDealMismatch
    )]
    pub milestone: Account<'info, Milestone>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_initial_submission_for_funded_pending_evidence() {
        assert!(can_submit_for_deal_status(DealStatus::Funded));
        assert!(can_submit_for_milestone_status(MilestoneStatus::PendingEvidence));
    }

    #[test]
    fn allows_resubmission_after_on_hold() {
        assert!(can_submit_for_milestone_status(MilestoneStatus::OnHold));
    }

    #[test]
    fn rejects_submission_before_funding() {
        assert!(!can_submit_for_deal_status(DealStatus::Draft));
    }

    #[test]
    fn rejects_submission_after_terminal_statuses() {
        assert!(!can_submit_for_milestone_status(MilestoneStatus::Approved));
        assert!(!can_submit_for_milestone_status(MilestoneStatus::InDispute));
        assert!(!can_submit_for_milestone_status(MilestoneStatus::PaidFull));
        assert!(!can_submit_for_milestone_status(MilestoneStatus::Resolved));
        assert!(!can_submit_for_milestone_status(MilestoneStatus::Refunded));
    }
}
