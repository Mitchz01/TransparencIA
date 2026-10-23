from collections.abc import Iterator

from sqlalchemy import inspect
from sqlmodel import Session, SQLModel, create_engine

from app.adapters.outbound.persistence import tables  # noqa: F401  registers the tables in metadata
from app.config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)


class OutdatedDatabase(RuntimeError):
    pass


def create_db() -> None:
    SQLModel.metadata.create_all(engine)
    # create_all doesn't add columns to existing tables, and spec 015 starts from an empty database.
    columns = {c["name"] for c in inspect(engine).get_columns("member")}
    if "account_id" not in columns:
        raise OutdatedDatabase(f"The database predates spec 015 (accounts): delete it and restart. ({DATABASE_URL})")


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
