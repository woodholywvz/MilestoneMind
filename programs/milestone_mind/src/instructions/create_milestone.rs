use anchor_lang::prelude::*;

use crate::{
    constants::{MAX_TITLE_LEN, MILESTONE_SEED},
    errors::MilestoneMindError,
    state::{Deal, Milestone, MilestoneStatus},
};

pub fn handler(
    ctx: Context<CreateMilestone>,
    index: u16,
    title: String,
    amount: u64,
) -> Result<()> {
    require!(title.len() <= MAX_TITLE_LEN, MilestoneMindError::TitleTooLong);
    require!(amount > 0, MilestoneMindError::InvalidAmount);
    require!(
        index < ctx.accounts.deal.milestone_count,
        MilestoneMindError::MilestoneIndexOutOfBounds
    );

    let deal_key = ctx.accounts.deal.key();
    let milestone = &mut ctx.accounts.milestone;
    milestone.deal = deal_key;
    milestone.index = index;
    milestone.title = title;
    milestone.amount = amount;
    milestone.released_amount = 0;
    milestone.status = MilestoneStatus::PendingEvidence;
    milestone.evidence_uri = String::new();
    milestone.evidence_hash = [0_u8; 32];
    milestone.evidence_summary = String::new();
    milestone.attachment_count = 0;
    milestone.last_submitted_at = 0;
    milestone.bump = ctx.bumps.milestone;

    Ok(())
}

#[derive(Accounts)]
#[instruction(index: u16, title: String, amount: u64)]
pub struct CreateMilestone<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        constraint = deal.client == client.key() @ MilestoneMindError::UnauthorizedClient
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        init,
        payer = client,
        space = Milestone::SPACE,
        seeds = [MILESTONE_SEED, deal.key().as_ref(), index.to_le_bytes().as_ref()],
        bump
    )]
    pub milestone: Account<'info, Milestone>,
    pub system_program: Program<'info, System>,
}
