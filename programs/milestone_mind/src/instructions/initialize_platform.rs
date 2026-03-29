use anchor_lang::prelude::*;

use crate::{constants::PLATFORM_SEED, state::PlatformConfig};

pub fn handler(
    ctx: Context<InitializePlatform>,
    admin: Pubkey,
    assessor: Pubkey,
    usdc_mint: Pubkey,
) -> Result<()> {
    let platform = &mut ctx.accounts.platform;

    platform.admin = admin;
    platform.assessor = assessor;
    platform.usdc_mint = usdc_mint;
    platform.next_deal_id = 0;
    platform.bump = ctx.bumps.platform;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = PlatformConfig::SPACE,
        seeds = [PLATFORM_SEED],
        bump
    )]
    pub platform: Account<'info, PlatformConfig>,
    pub system_program: Program<'info, System>,
}
