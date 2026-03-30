from app.assessment_types import AssessmentLayerResult
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def build_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "dealPubkey": "Deal11111111111111111111111111111111111111111",
        "milestonePubkey": "Mile1111111111111111111111111111111111111111",
        "milestoneIndex": 0,
        "dealTitle": "Production landing page rollout",
        "milestoneTitle": "Finalize deployment and acceptance package",
        "milestoneAmount": 7000000,
        "evidenceUri": "ipfs://milestonemind/final-package-v1",
        "evidenceHashHex": "ab" * 32,
        "evidenceSummary": (
            "Final delivered production package accepted by the client. "
            "Complete invoice bundle, screenshots, rollout notes, and deployment confirmation "
            "are attached for the milestone review."
        ),
        "attachmentCount": 3,
    }
    payload.update(overrides)
    return payload


def test_assess_approve_full(monkeypatch) -> None:
    monkeypatch.delenv("AI_ENABLE_LLM", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post("/assess", json=build_payload())

    assert response.status_code == 200
    body = response.json()

    assert body["decision"] == "approve"
    assert body["approvedBps"] == 10000
    assert body["engineVersion"] == "rules-v1"
    assert len(body["rationaleHashHex"]) == 64
    assert any("strong-keywords" in item for item in body["ruleTrace"])


def test_assess_approve_partial(monkeypatch) -> None:
    monkeypatch.delenv("AI_ENABLE_LLM", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        "/assess",
        json=build_payload(
            evidenceSummary=(
                "Final delivered package is complete and accepted. "
                "Includes deployment notes and screenshots for review."
            ),
            attachmentCount=2,
        ),
    )

    assert response.status_code == 200
    assert response.json()["approvedBps"] == 7000


def test_assess_hold(monkeypatch) -> None:
    monkeypatch.delenv("AI_ENABLE_LLM", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        "/assess",
        json=build_payload(
            evidenceSummary=(
                "Evidence bundle includes rollout notes, screenshots, and confirmation for review, "
                "but acceptance is still pending and additional sign-off is expected."
            ),
            attachmentCount=2,
        ),
    )

    assert response.status_code == 200
    body = response.json()

    assert body["decision"] == "hold"
    assert body["approvedBps"] == 0


def test_assess_dispute(monkeypatch) -> None:
    monkeypatch.delenv("AI_ENABLE_LLM", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        "/assess",
        json=build_payload(
            evidenceUri="",
            evidenceHashHex="",
            evidenceSummary="",
            attachmentCount=0,
        ),
    )

    assert response.status_code == 200
    body = response.json()

    assert body["decision"] == "dispute"
    assert any("required-evidence" in item for item in body["ruleTrace"])


def test_assessment_is_deterministic(monkeypatch) -> None:
    monkeypatch.delenv("AI_ENABLE_LLM", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    payload = build_payload(
        evidenceSummary=(
            "Production delivery complete with invoice, acceptance confirmation, "
            "and final rollout artifacts attached."
        )
    )

    first = client.post("/assess", json=payload)
    second = client.post("/assess", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_openai_layer_refines_output(monkeypatch) -> None:
    from app import engine

    monkeypatch.setenv("AI_ENABLE_LLM", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def fake_assess_with_openai(*args, **kwargs) -> AssessmentLayerResult:
        return AssessmentLayerResult(
            layer="semantic",
            decision="approve",
            approved_bps=7000,
            confidence_bps=8600,
            summary="Semantic analysis found substantial proof, but not enough for a full release.",
            score=74,
            trace=["openai: mocked semantic layer"],
            engine_version="openai-v1",
            metadata={"rag_score": 80},
        )

    monkeypatch.setattr(engine, "assess_with_openai", fake_assess_with_openai)

    response = client.post("/assess", json=build_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "approve"
    assert body["approvedBps"] == 7000
    assert body["engineVersion"] == "rules-v1+openai-v1"
    assert any("openai: mocked semantic layer" in item for item in body["ruleTrace"])
    assert any("synthesis:" in item for item in body["ruleTrace"])


def test_hard_block_skips_openai(monkeypatch) -> None:
    from app import engine

    monkeypatch.setenv("AI_ENABLE_LLM", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def should_not_run(*args, **kwargs) -> AssessmentLayerResult:
        raise AssertionError("semantic layer must not run for deterministic hard blocks")

    monkeypatch.setattr(engine, "assess_with_openai", should_not_run)

    response = client.post(
        "/assess",
        json=build_payload(
            evidenceUri="",
            evidenceHashHex="",
            evidenceSummary="",
            attachmentCount=0,
        ),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "dispute"
    assert any("hard block" in item for item in body["ruleTrace"])
