use anchor_lang::prelude::*;

#[error_code]
pub enum MilestoneMindError {
    #[msg("Only the deal client may perform this action.")]
    UnauthorizedClient,
    #[msg("Only the assigned freelancer may perform this action.")]
    UnauthorizedFreelancer,
    #[msg("The provided title exceeds the maximum allowed length.")]
    TitleTooLong,
    #[msg("The provided evidence URI exceeds the maximum allowed length.")]
    EvidenceUriTooLong,
    #[msg("Evidence URI cannot be empty.")]
    EmptyEvidenceUri,
    #[msg("The provided evidence summary exceeds the maximum allowed length.")]
    EvidenceSummaryTooLong,
    #[msg("Evidence summary cannot be empty.")]
    EmptyEvidenceSummary,
    #[msg("The provided assessment summary exceeds the maximum allowed length.")]
    AssessmentSummaryTooLong,
    #[msg("Milestone count must be greater than zero.")]
    InvalidMilestoneCount,
    #[msg("Milestone index is outside the declared milestone count.")]
    MilestoneIndexOutOfBounds,
    #[msg("The milestone does not belong to the provided deal.")]
    MilestoneDealMismatch,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Attachment count must be greater than zero.")]
    InvalidAttachmentCount,
    #[msg("The provided mint is not valid for this deal.")]
    InvalidMint,
    #[msg("The deal has already been funded.")]
    AlreadyFunded,
    #[msg("The deal is not in a fundable status.")]
    InvalidDealStatus,
    #[msg("The deal is not in a status that allows evidence submission.")]
    InvalidEvidenceDealStatus,
    #[msg("The milestone is not in a status that allows evidence submission.")]
    InvalidEvidenceMilestoneStatus,
    #[msg("The client token account does not have enough balance to fund this deal.")]
    InsufficientClientBalance,
    #[msg("Arithmetic overflow occurred.")]
    ArithmeticOverflow,
}
