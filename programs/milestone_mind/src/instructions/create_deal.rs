use anchor_lang::prelude::*;

use crate::{
    constants::{DEAL_SEED, MAX_TITLE_LEN, PLATFORM_SEED},
    errors::MilestoneMindError,
    state::{Deal, DealStatus, PlatformConfig},
};

pub fn handler(
    ctx: Context<CreateDeal>,
    freelancer: Pubkey,
    title: String,
    milestone_count: u16,
    total_amount: u64,
) -> Result<()> {
    require!(title.len() <= MAX_TITLE_LEN, MilestoneMindError::TitleTooLong);
    require!(
        milestone_count > 0,
        MilestoneMindError::InvalidMilestoneCount
    );
    require!(total_amount > 0, MilestoneMindError::InvalidAmount);

    let deal_id = ctx.accounts.platform.next_deal_id;
    let usdc_mint = ctx.accounts.platform.usdc_mint;
    let client_key = ctx.accounts.client.key();
    let next_deal_id = deal_id
        .checked_add(1)
        .ok_or(MilestoneMindError::ArithmeticOverflow)?;

    let deal = &mut ctx.accounts.deal;
    deal.deal_id = deal_id;
    deal.client = client_key;
    deal.freelancer = freelancer;
    deal.mint = usdc_mint;
    deal.total_amount = total_amount;
    deal.funded_amount = 0;
    deal.milestone_count = milestone_count;
    deal.settled_milestones = 0;
    deal.status = DealStatus::Draft;
    deal.title = title;
    deal.created_at = Clock::get()?.unix_timestamp;
    deal.bump = ctx.bumps.deal;

    ctx.accounts.platform.next_deal_id = next_deal_id;

    Ok(())
}

#[derive(Accounts)]
#[instruction(freelancer: Pubkey, title: String, milestone_count: u16, total_amount: u64)]
pub struct CreateDeal<'info> {
    #[account(
        mut,
        seeds = [PLATFORM_SEED],
        bump = platform.bump
    )]
    pub platform: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        init,
        payer = client,
        space = Deal::SPACE,
        seeds = [DEAL_SEED, platform.next_deal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub deal: Account<'info, Deal>,
    pub system_program: Program<'info, System>,
}
