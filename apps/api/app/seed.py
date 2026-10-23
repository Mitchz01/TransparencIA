"""Demo seed (spec 015): two accounts to sign in with and a project they share.

    cd backend && python -m app.seed

It drives the real API in-process (the same app as `fastapi dev`, on DATABASE_URL), so passwords are
hashed, profiles validated and the team formed with the invitation link exactly as in the app.
Running it again changes nothing: existing accounts are signed in, and the project is created once.
"""

from fastapi.testclient import TestClient

from app.main import app

PASSWORD = "agile-demo"

# Ana leads the demo project; Leo joins it with the link, so he sees the member view.
# Their photos are Pexels portraits that the frontend serves (apps/team/public/avatars/).
ACCOUNTS = [
    {
        "name": "Ana Gómez",
        "email": "ana@team.dev",
        "profile": {
            "role": "Backend",
            "seniority": "senior",
            "hours_per_week": 30,
            "skills": ["Python", "FastAPI"],
            "avatar_url": "/avatars/ana-gomez.jpg",
        },
    },
    {
        "name": "Leo Ruiz",
        "email": "leo@team.dev",
        "profile": {
            "role": "Frontend",
            "seniority": "mid",
            "hours_per_week": 20,
            "skills": ["React", "CSS"],
            "avatar_url": "/avatars/leo-ruiz.jpg",
        },
    },
]

PROJECT = {
    "name": "Tienda online (demo)",
    "description": "Una tienda de muebles artesanales, con catálogo, carrito y pagos con tarjeta.",
    "duration_weeks": 6,
}


def _check(response, action: str) -> dict:
    if response.status_code >= 400:
        raise SystemExit(f"{action} failed: {response.status_code} {response.text}")
    return response.json() if response.content else {}


def sign_in_or_up(client: TestClient, account: dict) -> str:
    """Signs in as the account, creating it (with its profile) the first time. Returns what happened."""
    client.cookies.clear()
    response = client.post("/api/auth/signin", json={"email": account["email"], "password": PASSWORD})
    if response.status_code == 200:
        # Accounts seeded before the photos existed get theirs; a photo already set is kept.
        if response.json().get("avatar_url") is None:
            photo = {"avatar_url": account["profile"]["avatar_url"]}
            _check(client.patch("/api/me", json=photo), f"Saving {account['email']}'s photo")
            return "existing, photo added"
        return "existing"
    if response.json().get("code") != "invalid_credentials":
        _check(response, f"Signing in as {account['email']}")
    created = client.post("/api/auth/signup", json={"name": account["name"], "email": account["email"], "password": PASSWORD})
    if created.status_code == 422:
        raise SystemExit(f"{account['email']} already exists with another password; sign in with yours or delete agile.db.")
    _check(created, f"Signing up {account['email']}")
    _check(client.patch("/api/me", json=account["profile"]), f"Saving {account['email']}'s profile")
    return "created"


def main() -> None:
    with TestClient(app) as client:
        ana, leo = ACCOUNTS
        results = {a["email"]: sign_in_or_up(client, a) for a in ACCOUNTS}

        sign_in_or_up(client, ana)
        projects = _check(client.get("/api/projects"), "Listing Ana's projects")
        project = next((p for p in projects if p["name"] == PROJECT["name"]), None)
        if project is None:
            project = _check(client.post("/api/projects", json=PROJECT), "Creating the demo project")
            token = _check(client.get(f"/api/projects/{project['id']}/invitation"), "Reading the invitation")["token"]
            sign_in_or_up(client, leo)
            _check(client.post(f"/api/invitations/{token}/join", json={}), "Leo joining the project")
            project_state = "created, Leo joined with the link"
        else:
            project_state = "already there"

    print("Demo accounts (password for both: %s)" % PASSWORD)
    for account in ACCOUNTS:
        print(f"  {account['email']:<16} {account['name']:<10} {results[account['email']]}")
    print(f"Project '{PROJECT['name']}' (id {project['id']}): {project_state}")
    print("Ana is its leader, Leo a member. Sign in at http://localhost:5173/login")


if __name__ == "__main__":
    main()
