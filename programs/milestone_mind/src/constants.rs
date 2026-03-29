pub const PLATFORM_SEED: &[u8] = b"platform";
pub const DEAL_SEED: &[u8] = b"deal";
pub const MILESTONE_SEED: &[u8] = b"milestone";
pub const ASSESSMENT_SEED: &[u8] = b"assessment";

pub const DISCRIMINATOR_SIZE: usize = 8;
pub const PUBKEY_SIZE: usize = 32;
pub const HASH_SIZE: usize = 32;
pub const STRING_PREFIX_SIZE: usize = 4;
pub const ENUM_SIZE: usize = 1;
pub const U64_SIZE: usize = 8;
pub const I64_SIZE: usize = 8;
pub const U16_SIZE: usize = 2;
pub const U8_SIZE: usize = 1;

pub const MAX_TITLE_LEN: usize = 80;
pub const MAX_EVIDENCE_URI_LEN: usize = 256;
pub const MAX_EVIDENCE_SUMMARY_LEN: usize = 280;
pub const MAX_ASSESSMENT_SUMMARY_LEN: usize = 280;
