"""Spec 020: the identification of whoever registers a public project, a natural or a legal person."""

import pytest

from app.domain.accounts import Account, nit_check_digit, validate_profile
from app.domain.errors import ValidationFailed
from datetime import datetime, timezone

NOW = datetime(2026, 10, 23, tzinfo=timezone.utc)

NATURAL = dict(
    person_type="natural", document_type="CC", document_number="1.082.345.678", phone="301 987 6543",
    address="Corregimiento Tasajera", municipality="Pueblo Viejo", department="Magdalena", data_consent_at=NOW,
)
LEGAL = dict(
    person_type="juridica", document_number="900.123.456-8", entity_nature="esal",
    legal_rep_name="Ana Gómez", legal_rep_document_type="CC", legal_rep_document_number="52123456",
    phone="3001234567", address="Calle 22 # 3-45", municipality="Santa Marta", department="Magdalena", data_consent_at=NOW,
)


def account(**fields) -> Account:
    return Account(id=1, email="ana@manglaresvivos.org", name="Fundación Manglares Vivos", **fields)


def failing(**fields) -> dict[str, str]:
    with pytest.raises(ValidationFailed) as error:
        validate_profile(account(**fields))
    return {e.field: e.message for e in error.value.errors}


@pytest.mark.parametrize(("nit", "digit"), [("800197268", "4"), ("900123456", "8"), ("899999001", "7")])
def test_the_check_digit_follows_dian(nit, digit):
    assert nit_check_digit(nit) == digit  # 800197268-4 is the DIAN's own NIT


def test_an_account_without_a_person_type_is_an_incomplete_profile_not_an_error():
    assert validate_profile(account()).person_type is None


def test_a_natural_person_is_saved_with_clean_document_and_phone():
    saved = validate_profile(account(**NATURAL))
    assert (saved.document_number, saved.phone) == ("1082345678", "3019876543")


def test_a_legal_person_reads_the_check_digit_after_the_dash_and_is_always_a_nit():
    saved = validate_profile(account(**LEGAL))
    assert (saved.document_type, saved.document_number, saved.verification_digit) == ("NIT", "900123456", "8")


def test_a_wrong_check_digit_is_rejected():
    assert failing(**{**LEGAL, "document_number": "900123456-3"}) == {"verification_digit": "The check digit doesn't match the NIT."}


def test_a_legal_person_needs_its_nature_and_legal_representative():
    errors = failing(**{**LEGAL, "entity_nature": None, "legal_rep_name": None, "legal_rep_document_number": None})
    assert set(errors) == {"entity_nature", "legal_rep_name", "legal_rep_document_number"}


def test_every_complete_profile_needs_contact_location_and_the_data_authorization():
    errors = failing(person_type="natural", document_type="CC", document_number="123456")
    assert set(errors) == {"phone", "address", "municipality", "department", "data_consent"}


def test_a_natural_person_cant_use_a_nit_and_a_cedula_is_digits():
    assert "document_type" in failing(**{**NATURAL, "document_type": "NIT"})
    assert "document_number" in failing(**{**NATURAL, "document_number": "AB12"})


def test_switching_to_natural_clears_the_legal_person_fields():
    saved = validate_profile(account(**{**LEGAL, **NATURAL}))
    assert (saved.entity_nature, saved.legal_rep_name, saved.verification_digit) == (None, None, None)
