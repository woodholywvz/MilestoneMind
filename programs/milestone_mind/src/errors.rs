use anchor_lang::prelude::*;

#[error_code]
pub enum MilestoneMindError {
    #[msg("Only the deal client may perform this action.")]
    UnauthorizedClient,
    #[msg("The provided title exceeds the maximum allowed length.")]
    TitleTooLong,
    #[msg("The provided evidence URI exceeds the maximum allowed length.")]
    EvidenceUriTooLong,
    #[msg("The provided evidence summary exceeds the maximum allowed length.")]
    EvidenceSummaryTooLong,
    #[msg("The provided assessment summary exceeds the maximum allowed length.")]
    AssessmentSummaryTooLong,
    #[msg("Milestone count must be greater than zero.")]
    InvalidMilestoneCount,
    #[msg("Milestone index is outside the declared milestone count.")]
    MilestoneIndexOutOfBounds,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("The provided mint is not valid for this deal.")]
    InvalidMint,
    #[msg("The deal has already been funded.")]
    AlreadyFunded,
    #[msg("The deal is not in a fundable status.")]
    InvalidDealStatus,
    #[msg("The client token account does not have enough balance to fund this deal.")]
    InsufficientClientBalance,
    #[msg("Arithmetic overflow occurred.")]
    ArithmeticOverflow,
}
