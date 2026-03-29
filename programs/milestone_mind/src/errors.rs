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
    #[msg("Arithmetic overflow occurred.")]
    ArithmeticOverflow,
}
