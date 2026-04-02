use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{
    constants::{MILESTONE_SEED, MOCK_USDC_DECIMALS, PLATFORM_SEED, VAULT_SEED},
    errors::MilestoneMindError,
    state::{Deal, DealStatus, Milestone, MilestoneStatus, PlatformConfig},
};

const MAX_BPS: u128 = 10_000;

pub fn handler(
    ctx: Context<ResolveDispute>,
    _milestone_index: u16,
    freelancer_split_bps: u16,
) -> Result<()> {
    require!(
        freelancer_split_bps <= MAX_BPS as u16,
        MilestoneMindError::InvalidFreelancerSplitBps
    );
    require!(
        matches!(ctx.accounts.deal.status, DealStatus::Disputed),
        MilestoneMindError::InvalidResolveDealStatus
    );
    require!(
        matches!(ctx.accounts.milestone.status, MilestoneStatus::InDispute),
        MilestoneMindError::InvalidResolveMilestoneStatus
    );

    let previous_released_amount = ctx.accounts.milestone.released_amount;
    let remaining_amount = ctx
        .accounts
        .milestone
        .amount
        .checked_sub(previous_released_amount)
        .ok_or(error!(MilestoneMindError::ArithmeticOverflow))?;

    require!(
        remaining_amount > 0,
        MilestoneMindError::NoRemainingSettlement
    );
    require!(
        ctx.accounts.vault_token_account.amount >= remaining_amount,
        MilestoneMindError::InsufficientVaultBalance
    );

    let freelancer_amount = calculate_split_amount(remaining_amount, freelancer_split_bps)?;
    let client_amount = remaining_amount
        .checked_sub(freelancer_amount)
        .ok_or(error!(MilestoneMindError::ArithmeticOverflow))?;

    let deal_key = ctx.accounts.deal.key();
    let signer_seeds: &[&[u8]] = &[
        VAULT_SEED,
        deal_key.as_ref(),
        &[ctx.bumps.vault_authority],
    ];
    let signer = &[signer_seeds];

    transfer_from_vault(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.vault_authority.to_account_info(),
        ctx.accounts.freelancer_token_account.to_account_info(),
        signer,
        freelancer_amount,
        ctx.accounts.mint.decimals,
    )?;
    transfer_from_vault(
        ctx.accounts.token_program.to_account_info(),
        ctx.accounts.vault_token_account.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.vault_authority.to_account_info(),
        ctx.accounts.client_token_account.to_account_info(),
        signer,
        client_amount,
        ctx.accounts.mint.decimals,
    )?;

    ctx.accounts.milestone.released_amount = previous_released_amount
        .checked_add(freelancer_amount)
        .ok_or(error!(MilestoneMindError::ArithmeticOverflow))?;
    ctx.accounts.milestone.status =
        map_resolve_status(previous_released_amount, freelancer_amount);

    Ok(())
}

fn calculate_split_amount(amount: u64, split_bps: u16) -> Result<u64> {
    let numerator = u128::from(amount)
        .checked_mul(u128::from(split_bps))
        .ok_or(error!(MilestoneMindError::ArithmeticOverflow))?;
    let split_amount = numerator
        .checked_div(MAX_BPS)
        .ok_or(error!(MilestoneMindError::ArithmeticOverflow))?;

    u64::try_from(split_amount).map_err(|_| error!(MilestoneMindError::ArithmeticOverflow))
}

fn map_resolve_status(previous_released_amount: u64, freelancer_amount: u64) -> MilestoneStatus {
    if freelancer_amount == 0 && previous_released_amount == 0 {
        MilestoneStatus::Refunded
    } else {
        MilestoneStatus::Resolved
    }
}

fn transfer_from_vault<'info>(
    token_program: AccountInfo<'info>,
    from: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    destination: AccountInfo<'info>,
    signer: &[&[&[u8]]],
    amount: u64,
    decimals: u8,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let transfer_accounts = TransferChecked {
        from,
        mint,
        to: destination,
        authority,
    };

    let cpi_context = CpiContext::new_with_signer(token_program, transfer_accounts, signer);
    token::transfer_checked(cpi_context, amount, decimals)
}

#[derive(Accounts)]
#[instruction(milestone_index: u16)]
pub struct ResolveDispute<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump
    )]
    pub platform: Account<'info, PlatformConfig>,
    #[account(
        mut,
        constraint = deal.mint == mint.key() @ MilestoneMindError::InvalidMint,
        constraint = deal.mint == platform.usdc_mint @ MilestoneMindError::InvalidMint
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        mut,
        constraint = admin.key() == platform.admin @ MilestoneMindError::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [MILESTONE_SEED, deal.key().as_ref(), milestone_index.to_le_bytes().as_ref()],
        bump = milestone.bump,
        constraint = milestone.deal == deal.key() @ MilestoneMindError::MilestoneDealMismatch
    )]
    pub milestone: Account<'info, Milestone>,
    #[account(
        constraint = mint.key() == platform.usdc_mint @ MilestoneMindError::InvalidMint,
        constraint = mint.decimals == MOCK_USDC_DECIMALS @ MilestoneMindError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA authority used only to sign vault settlement transfers and own the deal ATA.
    #[account(
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = freelancer.key() == deal.freelancer @ MilestoneMindError::UnauthorizedFreelancer
    )]
    pub freelancer: SystemAccount<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = freelancer
    )]
    pub freelancer_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = client.key() == deal.client @ MilestoneMindError::UnauthorizedClient
    )]
    pub client: SystemAccount<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = client
    )]
    pub client_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_settlement_splits() {
        assert_eq!(calculate_split_amount(600_000, 5_000).unwrap(), 300_000);
        assert_eq!(calculate_split_amount(3_000_000, 0).unwrap(), 0);
        assert_eq!(calculate_split_amount(5_000_000, 10_000).unwrap(), 5_000_000);
    }

    #[test]
    fn maps_refund_and_resolved_statuses() {
        assert_eq!(map_resolve_status(0, 0), MilestoneStatus::Refunded);
        assert_eq!(map_resolve_status(1_400_000, 300_000), MilestoneStatus::Resolved);
        assert_eq!(map_resolve_status(0, 5_000_000), MilestoneStatus::Resolved);
    }
}
