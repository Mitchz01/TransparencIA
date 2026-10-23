"""/api/auth and /api/me: accounts, sessions and the profile (spec 015, US1 and US2)."""

from fastapi import APIRouter, Depends, Request, Response, status

from app.adapters.inbound.http import dependencies as deps
from app.adapters.inbound.http.session_cookie import clear_session_cookie, read_token, set_session_cookie
from app.application.dto import ProfileUpdate, SignInRequest, SignUpRequest
from app.application.use_cases.accounts.sign_in import SignIn
from app.application.use_cases.accounts.sign_out import SignOut
from app.application.use_cases.accounts.sign_up import SignUp
from app.application.use_cases.accounts.update_profile import UpdateProfile
from app.domain.accounts import Account

router = APIRouter(prefix="/api", tags=["accounts"])


@router.post("/auth/signup", status_code=status.HTTP_201_CREATED, response_model=Account)
def sign_up(body: SignUpRequest, response: Response, use_case: SignUp = Depends(deps.get_sign_up)) -> Account:
    signed_in = use_case.execute(body)
    set_session_cookie(response, signed_in.token)
    response.headers["Location"] = "/api/me"
    return signed_in.account


@router.post("/auth/signin", response_model=Account)
def sign_in(body: SignInRequest, response: Response, use_case: SignIn = Depends(deps.get_sign_in)) -> Account:
    signed_in = use_case.execute(body)
    set_session_cookie(response, signed_in.token)
    return signed_in.account


@router.post("/auth/signout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(request: Request, use_case: SignOut = Depends(deps.get_sign_out)) -> Response:
    use_case.execute(read_token(request))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response)
    return response


@router.get("/me", response_model=Account)
def me(account: Account = Depends(deps.current_account)) -> Account:
    return account


@router.patch("/me", response_model=Account)
async def update_me(
    body: ProfileUpdate,
    account: Account = Depends(deps.current_account),
    use_case: UpdateProfile = Depends(deps.get_update_profile),
) -> Account:
    return await use_case.execute(account, body)
