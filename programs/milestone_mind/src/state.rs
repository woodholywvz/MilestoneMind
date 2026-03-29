use anchor_lang::prelude::*;

use crate::constants::{
    DISCRIMINATOR_SIZE, ENUM_SIZE, HASH_SIZE, I64_SIZE, MAX_ASSESSMENT_SUMMARY_LEN,
    MAX_EVIDENCE_SUMMARY_LEN, MAX_EVIDENCE_URI_LEN, MAX_TITLE_LEN, PUBKEY_SIZE,
    STRING_PREFIX_SIZE, U16_SIZE, U64_SIZE, U8_SIZE,
};

#[account]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub assessor: Pubkey,
    pub usdc_mint: Pubkey,
    pub next_deal_id: u64,
    pub bump: u8,
}

impl PlatformConfig {
    pub const SPACE: usize =
        DISCRIMINATOR_SIZE + (PUBKEY_SIZE * 3) + U64_SIZE + U8_SIZE;
}

#[account]
pub struct Deal {
    pub deal_id: u64,
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub funded_amount: u64,
    pub milestone_count: u16,
    pub settled_milestones: u16,
    pub status: DealStatus,
    pub title: String,
    pub created_at: i64,
    pub bump: u8,
}

impl Deal {
    pub const SPACE: usize = DISCRIMINATOR_SIZE
        + U64_SIZE
        + (PUBKEY_SIZE * 3)
        + U64_SIZE
        + U64_SIZE
        + U16_SIZE
        + U16_SIZE
        + ENUM_SIZE
        + STRING_PREFIX_SIZE
        + MAX_TITLE_LEN
        + I64_SIZE
        + U8_SIZE;
}

#[account]
pub struct Milestone {
    pub deal: Pubkey,
    pub index: u16,
    pub title: String,
    pub amount: u64,
    pub released_amount: u64,
    pub status: MilestoneStatus,
    pub evidence_uri: String,
    pub evidence_hash: [u8; 32],
    pub evidence_summary: String,
    pub attachment_count: u16,
    pub last_submitted_at: i64,
    pub bump: u8,
}

impl Milestone {
    pub const SPACE: usize = DISCRIMINATOR_SIZE
        + PUBKEY_SIZE
        + U16_SIZE
        + STRING_PREFIX_SIZE
        + MAX_TITLE_LEN
        + U64_SIZE
        + U64_SIZE
        + ENUM_SIZE
        + STRING_PREFIX_SIZE
        + MAX_EVIDENCE_URI_LEN
        + HASH_SIZE
        + STRING_PREFIX_SIZE
        + MAX_EVIDENCE_SUMMARY_LEN
        + U16_SIZE
        + I64_SIZE
        + U8_SIZE;
}

#[account]
pub struct Assessment {
    pub milestone: Pubkey,
    pub assessor: Pubkey,
    pub decision: AssessmentDecision,
    pub confidence_bps: u16,
    pub approved_bps: u16,
    pub rationale_hash: [u8; 32],
    pub summary: String,
    pub created_at: i64,
    pub bump: u8,
}

impl Assessment {
    pub const SPACE: usize = DISCRIMINATOR_SIZE
        + PUBKEY_SIZE
        + PUBKEY_SIZE
        + ENUM_SIZE
        + U16_SIZE
        + U16_SIZE
        + HASH_SIZE
        + STRING_PREFIX_SIZE
        + MAX_ASSESSMENT_SUMMARY_LEN
        + I64_SIZE
        + U8_SIZE;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum DealStatus {
    Draft,
    Active,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MilestoneStatus {
    PendingEvidence,
    UnderReview,
    Approved,
    Rejected,
    Released,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum AssessmentDecision {
    Approve,
    Reject,
    PartialApprove,
}
