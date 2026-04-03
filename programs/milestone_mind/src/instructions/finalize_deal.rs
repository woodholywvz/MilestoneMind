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

pub fn handler(ctx: Context<FinalizeDeal>) -> Result<()> {
    require!(
        matches!(ctx.accounts.deal.status, DealStatus::InProgress | DealStatus::Disputed),
        MilestoneMindError::InvalidFinalizeDealStatus
    );

    let expected_milestones = usize::from(ctx.accounts.deal.milestone_count);
    require!(
        ctx.remaining_accounts.len() == expected_milestones,
        MilestoneMindError::InvalidFinalizeMilestoneSet
    );

    for (index, account_info) in ctx.remaining_accounts.iter().enumerate() {
        let milestone_index = u16::try_from(index).map_err(|_| error!(MilestoneMindError::ArithmeticOverflow))?;
        let expected_milestone = Pubkey::find_program_address(
            &[
                MILESTONE_SEED,
                ctx.accounts.deal.key().as_ref(),
                milestone_index.to_le_bytes().as_ref(),
            ],
            &crate::ID,
        )
        .0;

        require!(
            account_info.key() == expected_milestone,
            MilestoneMindError::InvalidFinalizeMilestoneSet
        );

        let milestone = Account::<Milestone>::try_from(account_info)?;
        require!(
            milestone.deal == ctx.accounts.deal.key() && milestone.index == milestone_index,
            MilestoneMindError::InvalidFinalizeMilestoneSet
        );
        require!(
            is_terminal_milestone_status(milestone.status),
            MilestoneMindError::FinalizeRequiresAllMilestonesTerminal
        );
    }

    let refund_amount = compute_remaining_deal_vault_refund(ctx.accounts.vault_token_account.amount);

    if refund_amount > 0 {
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
            to: ctx.accounts.client_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
            signer,
        );
        token::transfer_checked(cpi_context, refund_amount, ctx.accounts.mint.decimals)?;
    }

    ctx.accounts.deal.status = DealStatus::Completed;
    ctx.accounts.deal.settled_milestones = ctx.accounts.deal.milestone_count;

    Ok(())
}

pub fn is_terminal_milestone_status(status: MilestoneStatus) -> bool {
    matches!(
        status,
        MilestoneStatus::PaidFull | MilestoneStatus::Resolved | MilestoneStatus::Refunded
    )
}

pub fn compute_remaining_deal_vault_refund(vault_balance: u64) -> u64 {
    vault_balance
}

#[derive(Accounts)]
pub struct FinalizeDeal<'info> {
    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform.bump
    )]
    pub platform: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(
        mut,
        constraint = deal.client == client.key() @ MilestoneMindError::UnauthorizedClient,
        constraint = deal.mint == mint.key() @ MilestoneMindError::InvalidMint,
        constraint = deal.mint == platform.usdc_mint @ MilestoneMindError::InvalidMint
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        constraint = mint.key() == platform.usdc_mint @ MilestoneMindError::InvalidMint,
        constraint = mint.decimals == MOCK_USDC_DECIMALS @ MilestoneMindError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA authority used only to sign vault refund transfers and own the deal ATA.
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
        init_if_needed,
        payer = client,
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
    fn recognizes_terminal_milestone_statuses() {
        assert!(is_terminal_milestone_status(MilestoneStatus::PaidFull));
        assert!(is_terminal_milestone_status(MilestoneStatus::Resolved));
        assert!(is_terminal_milestone_status(MilestoneStatus::Refunded));
        assert!(!is_terminal_milestone_status(MilestoneStatus::Approved));
        assert!(!is_terminal_milestone_status(MilestoneStatus::PaidPartial));
        assert!(!is_terminal_milestone_status(MilestoneStatus::InDispute));
    }

    #[test]
    fn computes_remaining_vault_refund() {
        assert_eq!(compute_remaining_deal_vault_refund(0), 0);
        assert_eq!(compute_remaining_deal_vault_refund(125_000), 125_000);
    }
}
