use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, TransferChecked},
};

use crate::{
    constants::{MOCK_USDC_DECIMALS, PLATFORM_SEED, VAULT_SEED},
    errors::MilestoneMindError,
    state::{Deal, DealStatus, PlatformConfig},
};

pub fn handler(ctx: Context<FundDeal>) -> Result<()> {
    let amount = ctx.accounts.deal.total_amount;
    let decimals = ctx.accounts.mint.decimals;

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.client_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.client.to_account_info(),
    };

    let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);
    token::transfer_checked(cpi_context, amount, decimals)?;

    let deal = &mut ctx.accounts.deal;
    deal.funded_amount = amount;
    deal.status = DealStatus::Funded;

    Ok(())
}

#[derive(Accounts)]
pub struct FundDeal<'info> {
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
        constraint = matches!(deal.status, DealStatus::Draft) @ MilestoneMindError::InvalidDealStatus,
        constraint = deal.funded_amount == 0 @ MilestoneMindError::AlreadyFunded,
        constraint = deal.mint == mint.key() @ MilestoneMindError::InvalidMint,
        constraint = deal.mint == platform.usdc_mint @ MilestoneMindError::InvalidMint
    )]
    pub deal: Account<'info, Deal>,
    #[account(
        constraint = mint.key() == platform.usdc_mint @ MilestoneMindError::InvalidMint,
        constraint = mint.decimals == MOCK_USDC_DECIMALS @ MilestoneMindError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA authority used only as the ATA owner for the deal vault.
    #[account(
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = client,
        constraint = client_token_account.amount >= deal.total_amount @ MilestoneMindError::InsufficientClientBalance
    )]
    pub client_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = client,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
