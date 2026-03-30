from app.assessment_types import KnowledgeMatch
from app.config import get_settings
from app.openai_layer import _cosine_similarity, _rag_support_score, _resolve_evidence_uri


def test_ipfs_gateway_resolution(monkeypatch) -> None:
    monkeypatch.setenv("AI_IPFS_GATEWAY", "https://gateway.example/ipfs")
    settings = get_settings()

    resolved = _resolve_evidence_uri("ipfs://cid-123/path/file.pdf", settings)

    assert resolved == "https://gateway.example/ipfs/cid-123/path/file.pdf"


def test_rag_support_score_uses_average_similarity() -> None:
    score = _rag_support_score(
        [
            KnowledgeMatch("full", "Full", 0.90, "full approval"),
            KnowledgeMatch("partial", "Partial", 0.70, "partial approval"),
        ]
    )

    assert score == 80


def test_cosine_similarity_handles_basic_vectors() -> None:
    assert round(_cosine_similarity([1.0, 0.0], [1.0, 0.0]), 4) == 1.0
    assert round(_cosine_similarity([1.0, 0.0], [0.0, 1.0]), 4) == 0.0
