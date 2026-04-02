use anchor_lang::prelude::*;

#[error_code]
pub enum MilestoneMindError {
    #[msg("Only the deal client may perform this action.")]
    UnauthorizedClient,
    #[msg("Only the assigned freelancer may perform this action.")]
    UnauthorizedFreelancer,
    #[msg("Only the whitelisted assessor may perform this action.")]
    UnauthorizedAssessor,
    #[msg("Only the deal client or whitelisted assessor may perform this action.")]
    UnauthorizedReleaseCaller,
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
    #[msg("Assessment summary cannot be empty.")]
    EmptyAssessmentSummary,
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
    #[msg("The deal is not in a status that allows assessment submission.")]
    InvalidAssessmentDealStatus,
    #[msg("The milestone is not in a status that allows assessment submission.")]
    InvalidAssessmentMilestoneStatus,
    #[msg("The deal is not in a status that allows release.")]
    InvalidReleaseDealStatus,
    #[msg("The milestone is not in a status that allows release.")]
    InvalidReleaseMilestoneStatus,
    #[msg("Confidence basis points must be between 0 and 10000.")]
    InvalidConfidenceBps,
    #[msg("Approved basis points must be between 0 and 10000.")]
    InvalidApprovedBps,
    #[msg("Approve decisions require approved basis points greater than zero.")]
    ApproveRequiresPositiveApprovedBps,
    #[msg("Hold and dispute decisions require approved basis points to be zero.")]
    NonApproveRequiresZeroApprovedBps,
    #[msg("The milestone has already been released.")]
    AlreadyReleased,
    #[msg("A release requires an approve assessment for this milestone.")]
    InvalidReleaseAssessment,
    #[msg("The assessment does not belong to the provided milestone.")]
    AssessmentMilestoneMismatch,
    #[msg("The computed release amount must be greater than zero.")]
    InvalidReleaseAmount,
    #[msg("The client token account does not have enough balance to fund this deal.")]
    InsufficientClientBalance,
    #[msg("The vault token account does not have enough balance for this release.")]
    InsufficientVaultBalance,
    #[msg("Arithmetic overflow occurred.")]
    ArithmeticOverflow,
}
