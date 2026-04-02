use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_DISPUTE_REASON_LEN, MILESTONE_SEED},
    errors::MilestoneMindError,
    state::{Deal, DealStatus, Milestone, MilestoneStatus},
};

pub fn handler(
    ctx: Context<OpenDispute>,
    _milestone_index: u16,
    reason: String,
) -> Result<()> {
    validate_reason(&reason)?;

    require!(
        matches!(ctx.accounts.deal.status, DealStatus::InProgress | DealStatus::Disputed),
        MilestoneMindError::InvalidDisputeDealStatus
    );
    require!(
        can_open_dispute_for_status(ctx.accounts.milestone.status),
        MilestoneMindError::InvalidDisputeMilestoneStatus
    );

    ctx.accounts.milestone.status = MilestoneStatus::InDispute;
    ctx.accounts.deal.status = DealStatus::Disputed;

    msg!(
        "dispute_opened: deal={}, milestone={}, opened_by={}, reason={}",
        ctx.accounts.deal.key(),
        ctx.accounts.milestone.key(),
        ctx.accounts.caller.key(),
        reason.trim(),
    );

    Ok(())
}

fn validate_reason(reason: &str) -> Result<()> {
    require!(
        !reason.trim().is_empty(),
        MilestoneMindError::EmptyDisputeReason
    );
    require!(
        reason.len() <= MAX_DISPUTE_REASON_LEN,
        MilestoneMindError::DisputeReasonTooLong
    );

    Ok(())
}

fn can_open_dispute_for_status(status: MilestoneStatus) -> bool {
    matches!(
        status,
        MilestoneStatus::Approved | MilestoneStatus::OnHold | MilestoneStatus::PaidPartial
    )
}

#[derive(Accounts)]
#[instruction(milestone_index: u16)]
pub struct OpenDispute<'info> {
    #[account(
        mut,
        constraint = caller.key() == deal.client || caller.key() == deal.freelancer
            @ MilestoneMindError::UnauthorizedDisputeCaller
    )]
    pub caller: Signer<'info>,
    #[account(mut)]
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
    fn allows_open_dispute_for_expected_statuses() {
        assert!(can_open_dispute_for_status(MilestoneStatus::Approved));
        assert!(can_open_dispute_for_status(MilestoneStatus::OnHold));
        assert!(can_open_dispute_for_status(MilestoneStatus::PaidPartial));
    }

    #[test]
    fn rejects_open_dispute_for_terminal_or_pending_statuses() {
        assert!(!can_open_dispute_for_status(MilestoneStatus::PendingEvidence));
        assert!(!can_open_dispute_for_status(MilestoneStatus::EvidenceSubmitted));
        assert!(!can_open_dispute_for_status(MilestoneStatus::InDispute));
        assert!(!can_open_dispute_for_status(MilestoneStatus::PaidFull));
        assert!(!can_open_dispute_for_status(MilestoneStatus::Resolved));
        assert!(!can_open_dispute_for_status(MilestoneStatus::Refunded));
    }
}
