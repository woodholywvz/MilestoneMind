from fastapi.testclient import TestClient

from app.main import app

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


def test_assess_approve_full() -> None:
    response = client.post("/assess", json=build_payload())

    assert response.status_code == 200
    body = response.json()

    assert body["decision"] == "approve"
    assert body["approvedBps"] == 10000
    assert body["confidenceBps"] > body["approvedBps"] - 3000
    assert body["engineVersion"] == "rules-v1"
    assert len(body["rationaleHashHex"]) == 64
    assert any("strong-keywords" in item for item in body["ruleTrace"])


def test_assess_approve_partial() -> None:
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
    body = response.json()

    assert body["decision"] == "approve"
    assert body["approvedBps"] == 7000


def test_assess_hold() -> None:
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


def test_assess_dispute() -> None:
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
    assert body["approvedBps"] == 0
    assert any("required-evidence" in item for item in body["ruleTrace"])


def test_assessment_is_deterministic() -> None:
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
