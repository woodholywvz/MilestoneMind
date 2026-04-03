use anchor_lang::prelude::*;

use crate::{
    errors::MilestoneMindError,
    state::{Deal, DealStatus},
};

pub fn handler(ctx: Context<CancelDraftDeal>) -> Result<()> {
    require!(
        matches!(ctx.accounts.deal.status, DealStatus::Draft),
        MilestoneMindError::InvalidCancelDealStatus
    );
    require!(
        ctx.accounts.deal.funded_amount == 0,
        MilestoneMindError::CannotCancelFundedDeal
    );

    ctx.accounts.deal.status = DealStatus::Cancelled;

    Ok(())
}

#[derive(Accounts)]
pub struct CancelDraftDeal<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        mut,
        constraint = deal.client == client.key() @ MilestoneMindError::UnauthorizedClient
    )]
    pub deal: Account<'info, Deal>,
}
