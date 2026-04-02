use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{
    constants::{ASSESSMENT_SEED, MOCK_USDC_DECIMALS, PLATFORM_SEED, VAULT_SEED},
    errors::MilestoneMindError,
    state::{
        Assessment, AssessmentDecision, Deal, DealStatus, Milestone, MilestoneStatus, PlatformConfig,
    },
};

const MAX_BPS: u128 = 10_000;

pub fn handler(ctx: Context<ReleaseApprovedFunds>, _milestone_index: u16) -> Result<()> {
    require!(
        matches!(ctx.accounts.deal.status, DealStatus::InProgress | DealStatus::Disputed),
        MilestoneMindError::InvalidReleaseDealStatus
    );
    require!(
        ctx.accounts.milestone.released_amount == 0,
        MilestoneMindError::AlreadyReleased
    );
    require!(
        matches!(ctx.accounts.milestone.status, MilestoneStatus::Approved),
        MilestoneMindError::InvalidReleaseMilestoneStatus
    );
    require!(
        matches!(ctx.accounts.assessment.decision, AssessmentDecision::Approve),
        MilestoneMindError::InvalidReleaseAssessment
    );

    let release_amount = calculate_release_amount(
        ctx.accounts.milestone.amount,
        ctx.accounts.assessment.approved_bps,
    )?;

    require!(
        release_amount > 0,
        MilestoneMindError::InvalidReleaseAmount
    );
    require!(
        ctx.accounts.vault_token_account.amount >= release_amount,
        MilestoneMindError::InsufficientVaultBalance
    );

    let deal_key = ctx.accounts.deal.key();
    let signer_seeds: &[&[u8]] = &[
        VAULT_SEED,
        deal_key.as_ref(),
        &[ctx.bumps.vault_authority],
    ];
    let signer = &[signer_seeds];

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.freelancer_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        signer,
    );
    token::transfer_checked(cpi_context, release_amount, ctx.accounts.mint.decimals)?;

    ctx.accounts.milestone.released_amount = release_amount;
    ctx.accounts.milestone.status = map_release_status(ctx.accounts.assessment.approved_bps);

    Ok(())
}

fn calculate_release_amount(amount: u64, approved_bps: u16) -> Result<u64> {
    let numerator = u128::from(amount)
        .checked_mul(u128::from(approved_bps))
        .ok_or(error!(MilestoneMindError::ArithmeticOverflow))?;
    let release_amount = numerator
        .checked_div(MAX_BPS)
        .ok_or(error!(MilestoneMindError::ArithmeticOverflow))?;

    u64::try_from(release_amount).map_err(|_| error!(MilestoneMindError::ArithmeticOverflow))
}

fn map_release_status(approved_bps: u16) -> MilestoneStatus {
    if approved_bps == MAX_BPS as u16 {
        MilestoneStatus::PaidFull
    } else {
        MilestoneStatus::PaidPartial
    }
}

#[derive(Accounts)]
#[instruction(milestone_index: u16)]
pub struct ReleaseApprovedFunds<'info> {
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
        constraint = authority.key() == deal.client || authority.key() == platform.assessor
            @ MilestoneMindError::UnauthorizedReleaseCaller
    )]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [crate::constants::MILESTONE_SEED, deal.key().as_ref(), milestone_index.to_le_bytes().as_ref()],
        bump = milestone.bump,
        constraint = milestone.deal == deal.key() @ MilestoneMindError::MilestoneDealMismatch
    )]
    pub milestone: Account<'info, Milestone>,
    #[account(
        seeds = [ASSESSMENT_SEED, milestone.key().as_ref()],
        bump = assessment.bump,
        constraint = assessment.milestone == milestone.key() @ MilestoneMindError::AssessmentMilestoneMismatch
    )]
    pub assessment: Account<'info, Assessment>,
    #[account(
        constraint = mint.key() == platform.usdc_mint @ MilestoneMindError::InvalidMint,
        constraint = mint.decimals == MOCK_USDC_DECIMALS @ MilestoneMindError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA authority used only to sign vault transfers and own the deal ATA.
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
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = freelancer
    )]
    pub freelancer_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_partial_release_amount() {
        let release_amount = calculate_release_amount(2_000_000, 7_000).unwrap();

        assert_eq!(release_amount, 1_400_000);
        assert_eq!(map_release_status(7_000), MilestoneStatus::PaidPartial);
    }

    #[test]
    fn calculates_full_release_amount() {
        let release_amount = calculate_release_amount(5_000_000, 10_000).unwrap();

        assert_eq!(release_amount, 5_000_000);
        assert_eq!(map_release_status(10_000), MilestoneStatus::PaidFull);
    }
}
