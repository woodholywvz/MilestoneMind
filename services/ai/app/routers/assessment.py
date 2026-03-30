from __future__ import annotations

from fastapi import APIRouter

from app.engine import assess_submission
from app.schemas import AssessRequest, AssessResponse

router = APIRouter()


@router.post("/assess", response_model=AssessResponse)
def assess(payload: AssessRequest) -> AssessResponse:
    return assess_submission(payload)
