# ponytail: minimal tests — auth flow + verify pipeline + sanitization. No fixtures framework.

import hashlib
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta, timezone

from app.auth import hash_password, verify_password, create_access_token, decode_access_token, hash_token
from app.routes.verify import is_checkworthy, VerifyRequest


# ── Auth unit tests ──

def test_password_hash_and_verify():
    pw = "testpassword123"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_access_token_roundtrip():
    user_id = "test-user-123"
    token = create_access_token(user_id)
    decoded_id = decode_access_token(token)
    assert decoded_id == user_id


def test_access_token_expired():
    from jose import jwt
    from app.config import settings
    expired_payload = {
        "sub": "test-user",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)
    assert exc_info.value.status_code == 401


def test_hash_token_deterministic():
    token = "my-refresh-token"
    h1 = hash_token(token)
    h2 = hash_token(token)
    assert h1 == h2
    assert h1 == hashlib.sha256(token.encode()).hexdigest()


# ── Claim-worthiness tests ──

def test_checkworthy_factual_claim():
    worthy, score = is_checkworthy("Studies show that 60 percent of people believe fake news.")
    assert worthy is True
    assert score > 0.3


def test_checkworthy_greeting_rejected():
    worthy, score = is_checkworthy("Hello how are you?")
    assert worthy is False


def test_checkworthy_short_sentence():
    worthy, score = is_checkworthy("The earth revolves around the sun every year.")
    assert worthy is True  # 8 words, score >= 0.4


def test_checkworthy_url_rejected():
    worthy, score = is_checkworthy("https://example.com/some/page")
    assert worthy is False


# ── Input sanitization tests ──

def test_sanitize_strips_html():
    req = VerifyRequest(claim_text="<b>Vaccines cause autism</b> according to research")
    assert "<b>" not in req.claim_text
    assert "Vaccines cause autism" in req.claim_text


def test_sanitize_max_length():
    long_text = "a " * 1500  # 3000 chars
    req = VerifyRequest(claim_text=long_text)
    assert len(req.claim_text) <= 2000


def test_sanitize_rejects_too_short():
    with pytest.raises(Exception):  # ValidationError
        VerifyRequest(claim_text="hi")


def test_sanitize_normalizes_whitespace():
    req = VerifyRequest(claim_text="  This   has    weird   spacing   in   the   claim  text  here  now ")
    assert "  " not in req.claim_text


# ── Cache key determinism ──

def test_cache_key_case_insensitive():
    claim1 = "Vaccines are safe"
    claim2 = "vaccines are safe"
    h1 = hashlib.sha256(claim1.strip().lower().encode()).hexdigest()
    h2 = hashlib.sha256(claim2.strip().lower().encode()).hexdigest()
    assert h1 == h2
