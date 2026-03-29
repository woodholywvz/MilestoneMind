use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::{CreateDeal, CreateMilestone, FundDeal, InitializePlatform};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x");

#[program]
pub mod milestone_mind {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        admin: Pubkey,
        assessor: Pubkey,
        usdc_mint: Pubkey,
    ) -> Result<()> {
        instructions::initialize_platform::handler(ctx, admin, assessor, usdc_mint)
    }

    pub fn create_deal(
        ctx: Context<CreateDeal>,
        freelancer: Pubkey,
        title: String,
        milestone_count: u16,
        total_amount: u64,
    ) -> Result<()> {
        instructions::create_deal::handler(ctx, freelancer, title, milestone_count, total_amount)
    }

    pub fn create_milestone(
        ctx: Context<CreateMilestone>,
        index: u16,
        title: String,
        amount: u64,
    ) -> Result<()> {
        instructions::create_milestone::handler(ctx, index, title, amount)
    }

    pub fn fund_deal(ctx: Context<FundDeal>) -> Result<()> {
        instructions::fund_deal::handler(ctx)
    }
}
