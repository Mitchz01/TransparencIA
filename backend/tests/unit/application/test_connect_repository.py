import asyncio

import pytest

from app.adapters.outbound.code_host.fake import FakeCodeHost
from app.application.use_cases.integrations.connect_repository import ConnectRepository
from app.application.use_cases.integrations.disconnect_repository import DisconnectRepository
from app.domain.errors import CodeHostUnavailable, ProjectNotFound, RepositoryNotAccessible, RepositoryNotConnected, ValidationFailed
from app.domain.integrations import ExternalLink, RepoAccess
from tests.fakes import InMemoryUnitOfWork, RecordingEventBus, project

run = asyncio.run
HOOK_URL = "https://planner.test/webhooks/github"


class Hosts:
    """A CodeHostFactory that hands out one FakeCodeHost and remembers the tokens asked for."""

    def __init__(self, host: FakeCodeHost | None = None):
        self.host = host or FakeCodeHost()
        self.tokens: list[str | None] = []

    def __call__(self, token: str | None) -> FakeCodeHost:
        self.tokens.append(token)
        return self.host


def _setup(**fields):
    uow = InMemoryUnitOfWork()
    saved = uow.projects.add(project(**fields))
    uow.commit()
    return uow, saved.id, RecordingEventBus(), Hosts()


def _connect(uow, bus, hosts, webhook_url=HOOK_URL, handlers=()):
    return ConnectRepository(uow, bus, hosts, webhook_url, "s3cret", handlers)


# ---------- ConnectRepository ----------


def test_connect_saves_repo_token_and_webhook():
    uow, pid, bus, hosts = _setup()
    connected: list[int] = []

    async def handler(project_id: int) -> None:
        connected.append(project_id)

    connection = run(_connect(uow, bus, hosts, handlers=[handler]).execute(pid, " acme/app ", "ghp_new"))
    assert connection.model_dump() == {
        "repository": "acme/app",
        "has_token": True,
        "mode": "test",
        "webhook_registered": True,
        "replaced": None,
    }
    saved = uow.projects.get(pid)
    assert (saved.repository, saved.github_token, saved.webhook_id) == ("acme/app", "ghp_new", 1)
    assert hosts.tokens[0] == "ghp_new"
    [hook] = hosts.host.called("register_webhook")
    assert (hook["repository"], hook["url"]) == ("acme/app", HOOK_URL)
    [event] = bus.events
    assert (event.type, event.repository, event.summary) == ("repository_connected", "acme/app", "Connected acme/app")
    assert connected == [pid]


def test_connect_without_public_url_skips_the_webhook():
    uow, pid, bus, hosts = _setup()
    connection = run(_connect(uow, bus, hosts, webhook_url=None).execute(pid, "acme/app"))
    assert connection.webhook_registered is False and connection.has_token is False
    assert hosts.host.called("register_webhook") == []
    assert uow.projects.get(pid).webhook_id is None


@pytest.mark.parametrize(
    ("access", "reason"),
    [
        (RepoAccess(status="not_found"), "not_found"),
        (RepoAccess(status="forbidden"), "forbidden"),
        (RepoAccess(status="ok", can_write=True, can_admin=False), "missing_permissions"),  # can't manage webhooks
        (RepoAccess(status="ok", can_write=False, can_admin=False), "missing_permissions"),
    ],
)
def test_no_access_raises_and_saves_nothing(access, reason):
    uow, pid, bus, hosts = _setup()
    hosts.host.access["acme/app"] = access
    with pytest.raises(RepositoryNotAccessible) as info:
        run(_connect(uow, bus, hosts).execute(pid, "acme/app", "ghp_new"))
    assert info.value.reason == reason and info.value.extra() == {"reason": reason}
    saved = uow.projects.get(pid)
    assert (saved.repository, saved.github_token) == (None, None)
    assert hosts.host.called("register_webhook") == [] and bus.events == []


def test_without_webhook_admin_rights_are_not_needed():
    uow, pid, bus, hosts = _setup()
    hosts.host.access["acme/app"] = RepoAccess(status="ok", can_write=True, can_admin=False)
    assert run(_connect(uow, bus, hosts, webhook_url=None).execute(pid, "acme/app")).repository == "acme/app"


def test_invalid_repository_and_unknown_project():
    uow, pid, bus, hosts = _setup()
    with pytest.raises(ValidationFailed) as info:
        run(_connect(uow, bus, hosts).execute(pid, "not a repo"))
    assert info.value.errors[0].field == "repository"
    with pytest.raises(ProjectNotFound):
        run(_connect(uow, bus, hosts).execute(99, "acme/app"))
    assert hosts.host.calls == []


def test_code_host_down_propagates_and_saves_nothing():
    uow, pid, bus, hosts = _setup()

    async def down(repository: str) -> RepoAccess:
        raise CodeHostUnavailable()

    hosts.host.check_access = down  # type: ignore[method-assign]
    with pytest.raises(CodeHostUnavailable):
        run(_connect(uow, bus, hosts).execute(pid, "acme/app"))
    assert uow.projects.get(pid).repository is None


def test_replace_deletes_the_old_webhook_and_keeps_links():
    uow, pid, bus, hosts = _setup(repository="acme/old", github_token="ghp_old", webhook_id=7)
    uow.links.add(ExternalLink(project_id=pid, task_id=1, kind="issue", repository="acme/old", number=3, url="u"))
    uow.commit()

    connection = run(_connect(uow, bus, hosts).execute(pid, "acme/new"))
    assert connection.replaced == "acme/old" and connection.has_token is True  # missing token = keep it
    assert hosts.host.called("delete_webhook") == [{"repository": "acme/old", "hook_id": 7}]
    assert hosts.tokens == ["ghp_old", "ghp_old"]  # new repo checked with the kept token; old hook deleted with it
    saved = uow.projects.get(pid)
    assert (saved.repository, saved.github_token, saved.webhook_id) == ("acme/new", "ghp_old", 1)
    assert [link.number for link in uow.links.list_by_project(pid)] == [3]
    assert bus.events[0].summary == "Connected acme/new (replaces acme/old)"


def test_reconnect_same_repo_replaces_its_webhook_and_empty_token_deletes_it():
    uow, pid, bus, hosts = _setup(repository="acme/app", github_token="ghp_old", webhook_id=7)
    connection = run(_connect(uow, bus, hosts).execute(pid, "acme/app", ""))
    assert connection.replaced is None and connection.has_token is False
    assert hosts.host.called("delete_webhook") == [{"repository": "acme/app", "hook_id": 7}]
    assert hosts.tokens[0] is None  # checked with the installation's token / test mode
    assert uow.projects.get(pid).github_token is None


def test_failing_old_webhook_delete_doesnt_stop_the_replacement():
    uow, pid, bus, hosts = _setup(repository="acme/old", webhook_id=7)

    async def fail(repository: str, hook_id: int) -> None:
        raise RuntimeError("GitHub said no")

    hosts.host.delete_webhook = fail  # type: ignore[method-assign]
    assert run(_connect(uow, bus, hosts).execute(pid, "acme/new")).replaced == "acme/old"
    assert uow.projects.get(pid).repository == "acme/new"


# ---------- DisconnectRepository ----------


def test_disconnect_removes_webhook_and_token_but_keeps_links():
    uow, pid, bus, hosts = _setup(repository="acme/app", github_token="ghp", webhook_id=7)
    uow.links.add(ExternalLink(project_id=pid, task_id=1, kind="issue", repository="acme/app", number=3, url="u"))
    uow.commit()

    run(DisconnectRepository(uow, bus, hosts).execute(pid))
    saved = uow.projects.get(pid)
    assert (saved.repository, saved.github_token, saved.webhook_id) == (None, None, None)
    assert hosts.host.called("delete_webhook") == [{"repository": "acme/app", "hook_id": 7}]
    assert hosts.tokens == ["ghp"]
    assert len(uow.links.list_by_project(pid)) == 1
    [event] = bus.events
    assert (event.type, event.repository) == ("repository_disconnected", "acme/app")


def test_disconnect_survives_a_failing_webhook_delete():
    uow, pid, bus, hosts = _setup(repository="acme/app", webhook_id=7)

    async def fail(repository: str, hook_id: int) -> None:
        raise CodeHostUnavailable()

    hosts.host.delete_webhook = fail  # type: ignore[method-assign]
    run(DisconnectRepository(uow, bus, hosts).execute(pid))
    assert uow.projects.get(pid).repository is None


def test_disconnect_errors():
    uow, pid, bus, hosts = _setup()
    with pytest.raises(RepositoryNotConnected):
        run(DisconnectRepository(uow, bus, hosts).execute(pid))
    with pytest.raises(ProjectNotFound):
        run(DisconnectRepository(uow, bus, hosts).execute(99))
