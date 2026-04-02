use anchor_lang::prelude::*;

use crate::{
    constants::{ASSESSMENT_SEED, MAX_ASSESSMENT_SUMMARY_LEN, PLATFORM_SEED},
    errors::MilestoneMindError,
    state::{Assessment, AssessmentDecision, Deal, DealStatus, Milestone, MilestoneStatus, PlatformConfig},
};

const MAX_BPS: u16 = 10_000;

pub fn handler(
    ctx: Context<SubmitAssessment>,
    _milestone_index: u16,
    decision: AssessmentDecision,
    confidence_bps: u16,
    approved_bps: u16,
    rationale_hash: [u8; 32],
    summary: String,
) -> Result<()> {
    validate_assessment_payload(confidence_bps, approved_bps, &summary)?;
    validate_approved_bps_for_decision(decision, approved_bps)?;

    require!(
        matches!(ctx.accounts.deal.status, DealStatus::InProgress),
        MilestoneMindError::InvalidAssessmentDealStatus
    );
    require!(
        matches!(ctx.accounts.milestone.status, MilestoneStatus::EvidenceSubmitted),
        MilestoneMindError::InvalidAssessmentMilestoneStatus
    );

    let now = Clock::get()?.unix_timestamp;
    let (milestone_status, next_deal_status) = map_decision_to_status(decision);

    {
        let assessment = &mut ctx.accounts.assessment;
        assessment.milestone = ctx.accounts.milestone.key();
        assessment.assessor = ctx.accounts.assessor.key();
        assessment.decision = decision;
        assessment.confidence_bps = confidence_bps;
        assessment.approved_bps = approved_bps;
        assessment.rationale_hash = rationale_hash;
        assessment.summary = summary;
        assessment.created_at = now;
        assessment.bump = ctx.bumps.assessment;
    }

    ctx.accounts.milestone.status = milestone_status;

    if let Some(status) = next_deal_status {
        ctx.accounts.deal.status = status;
    }

    Ok(())
}

fn validate_assessment_payload(
    confidence_bps: u16,
    approved_bps: u16,
    summary: &str,
) -> Result<()> {
    require!(confidence_bps <= MAX_BPS, MilestoneMindError::InvalidConfidenceBps);
    require!(approved_bps <= MAX_BPS, MilestoneMindError::InvalidApprovedBps);
    require!(
        !summary.trim().is_empty(),
        MilestoneMindError::EmptyAssessmentSummary
    );
    require!(
        summary.len() <= MAX_ASSESSMENT_SUMMARY_LEN,
        MilestoneMindError::AssessmentSummaryTooLong
    );

    Ok(())
}

fn validate_approved_bps_for_decision(
    decision: AssessmentDecision,
    approved_bps: u16,
) -> Result<()> {
    match decision {
        AssessmentDecision::Approve => {
            require!(
                approved_bps > 0,
                MilestoneMindError::ApproveRequiresPositiveApprovedBps
            );
        }
        AssessmentDecision::Hold | AssessmentDecision::Dispute => {
            require!(
                approved_bps == 0,
                MilestoneMindError::NonApproveRequiresZeroApprovedBps
            );
        }
    }

    Ok(())
}

fn map_decision_to_status(
    decision: AssessmentDecision,
) -> (MilestoneStatus, Option<DealStatus>) {
    match decision {
        AssessmentDecision::Approve => (MilestoneStatus::Approved, None),
        AssessmentDecision::Hold => (MilestoneStatus::OnHold, None),
        AssessmentDecision::Dispute => (
            MilestoneStatus::InDispute,
            Some(DealStatus::Disputed),
        ),
    }
}

#[derive(Accounts)]
#[instruction(milestone_index: u16)]
pub struct SubmitAssessment<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump
    )]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        mut,
        constraint = assessor.key() == platform.assessor @ MilestoneMindError::UnauthorizedAssessor
    )]
    pub assessor: Signer<'info>,
    #[account(mut)]
    pub deal: Account<'info, Deal>,
    #[account(
        mut,
        seeds = [crate::constants::MILESTONE_SEED, deal.key().as_ref(), milestone_index.to_le_bytes().as_ref()],
        bump = milestone.bump,
        constraint = milestone.deal == deal.key() @ MilestoneMindError::MilestoneDealMismatch
    )]
    pub milestone: Account<'info, Milestone>,
    #[account(
        init_if_needed,
        payer = assessor,
        space = Assessment::SPACE,
        seeds = [ASSESSMENT_SEED, milestone.key().as_ref()],
        bump
    )]
    pub assessment: Account<'info, Assessment>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_approve_to_approved_status() {
        let (milestone_status, deal_status) = map_decision_to_status(AssessmentDecision::Approve);

        assert_eq!(milestone_status, MilestoneStatus::Approved);
        assert_eq!(deal_status, None);
    }

    #[test]
    fn maps_hold_to_on_hold_status() {
        let (milestone_status, deal_status) = map_decision_to_status(AssessmentDecision::Hold);

        assert_eq!(milestone_status, MilestoneStatus::OnHold);
        assert_eq!(deal_status, None);
    }

    #[test]
    fn maps_dispute_to_disputed_statuses() {
        let (milestone_status, deal_status) = map_decision_to_status(AssessmentDecision::Dispute);

        assert_eq!(milestone_status, MilestoneStatus::InDispute);
        assert_eq!(deal_status, Some(DealStatus::Disputed));
    }
}
