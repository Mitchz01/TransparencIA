"""/api/proposals and /api/projects/{id}/proposals (spec 005, UC-04)."""

from fastapi import APIRouter, Depends, Query, status

from app.adapters.inbound.http import dependencies as deps
from app.adapters.inbound.http.background import spawn
from app.application.dto import BulkApprove, BulkResult, ProposalAdjust, ProposalReject
from app.application.use_cases.proposals.apply_proposal import ApplyProposal, RetryApply
from app.application.use_cases.proposals.approve_many import ApproveProposals
from app.application.use_cases.proposals.list_proposals import GetProposal, ListProposals
from app.application.use_cases.proposals.resolve_proposal import AdjustProposal, ApproveProposal, RejectProposal
from app.domain.proposals import Proposal, ProposalStatus

router = APIRouter(prefix="/api", tags=["proposals"])


@router.get("/projects/{project_id}/proposals", response_model=list[Proposal], dependencies=[Depends(deps.allow("view"))])
def list_proposals(
    project_id: int,
    status: ProposalStatus | None = Query(None),
    use_case: ListProposals = Depends(deps.get_list_proposals),
) -> list[Proposal]:
    return use_case.execute(project_id, status)


@router.get("/proposals/{proposal_id}", response_model=Proposal, dependencies=[Depends(deps.allow("view", "proposal"))])
def get_proposal(proposal_id: int, use_case: GetProposal = Depends(deps.get_get_proposal)) -> Proposal:
    return use_case.execute(proposal_id)


@router.post("/proposals/{proposal_id}/approve", response_model=Proposal, dependencies=[Depends(deps.allow("manage", "proposal"))])
async def approve(
    proposal_id: int,
    use_case: ApproveProposal = Depends(deps.get_approve_proposal),
    apply: ApplyProposal = Depends(deps.get_apply_proposal),
) -> Proposal:
    proposal = await use_case.execute(proposal_id)
    spawn(apply.execute(proposal_id))  # applying never runs inside the request
    return proposal


@router.post("/proposals/{proposal_id}/adjust", response_model=Proposal, dependencies=[Depends(deps.allow("manage", "proposal"))])
async def adjust(
    proposal_id: int,
    body: ProposalAdjust,
    use_case: AdjustProposal = Depends(deps.get_adjust_proposal),
    apply: ApplyProposal = Depends(deps.get_apply_proposal),
) -> Proposal:
    proposal = await use_case.execute(proposal_id, body.content)
    spawn(apply.execute(proposal_id))
    return proposal


@router.post("/proposals/{proposal_id}/reject", response_model=Proposal, dependencies=[Depends(deps.allow("manage", "proposal"))])
async def reject(
    proposal_id: int,
    body: ProposalReject,
    use_case: RejectProposal = Depends(deps.get_reject_proposal),
    apply: ApplyProposal = Depends(deps.get_apply_proposal),
) -> Proposal:
    proposal = await use_case.execute(proposal_id, body.reason)
    spawn(apply.execute(proposal_id))  # the owner decides what a rejection triggers (e.g. 002 redoes the stage)
    return proposal


@router.post("/proposals/{proposal_id}/apply", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(deps.allow("manage", "proposal"))])
async def retry_apply(
    proposal_id: int,
    use_case: RetryApply = Depends(deps.get_retry_apply),
    apply: ApplyProposal = Depends(deps.get_apply_proposal),
) -> dict[str, object]:
    use_case.execute(proposal_id)
    spawn(apply.execute(proposal_id))
    return {"proposal_id": proposal_id, "status": "applying"}


@router.post("/projects/{project_id}/proposals/approve", response_model=list[BulkResult], dependencies=[Depends(deps.allow("manage"))])
async def approve_many(
    project_id: int,
    body: BulkApprove,
    use_case: ApproveProposals = Depends(deps.get_approve_proposals),
    apply: ApplyProposal = Depends(deps.get_apply_proposal),
) -> list[BulkResult]:
    results = await use_case.execute(project_id, body.ids)
    for result in results:
        if result.ok:
            spawn(apply.execute(result.id))
    return results
