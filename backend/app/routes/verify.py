# ponytail: verification pipeline — two stages, Redis cache, Ollama LLM

import hashlib
import json
import re
import time
from datetime import date, timezone, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.config import settings

router = APIRouter(prefix="/api/v1", tags=["verify"])

# ── Redis client (lazy init) ──
_redis = None


async def get_redis():
    global _redis
    if _redis is None:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


# ── Request/Response models ──
class VerifyRequest(BaseModel):
    claim_text: str

    @field_validator("claim_text")
    @classmethod
    def sanitize_claim(cls, v: str) -> str:
        # Strip HTML tags
        v = re.sub(r"<[^>]*>", "", v)
        # Normalize whitespace
        v = " ".join(v.split())
        # Cap length
        if len(v) > 2000:
            v = v[:2000]
        if len(v) < 10:
            raise ValueError("Claim too short. Please highlight a complete sentence.")
        return v


class SourceItem(BaseModel):
    title: str
    url: str
    snippet: str | None = None


class VerifyResponse(BaseModel):
    verdict: str
    confidence: int | None
    explanation: str
    sources: list[SourceItem]
    latency_ms: int


class FeedbackRequest(BaseModel):
    claim_text: str
    feedback: str  # "helpful" or "not_helpful"


class UsageResponse(BaseModel):
    checks_today: int
    daily_limit: int
    tier: str


# ── Quota check ──
async def check_and_increment_quota(user: User, redis_client) -> int:
    today = date.today().isoformat()
    key = f"quota:{user.id}:{today}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, 86400)

    limit = settings.DAILY_CHECK_LIMIT  # ponytail: same limit for all, upgrade path later
    if count > limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {limit} checks reached. Resets at midnight UTC.",
        )
    return count


# ── Stage 1: Claim-worthiness (lightweight) ──
def is_checkworthy(claim: str) -> tuple[bool, float]:
    """
    ponytail: keyword heuristic for V1. Upgrade to ClaimBuster model when needed.
    Returns (checkworthy, score).
    """
    claim_lower = claim.lower()

    # Obvious non-claims
    non_claim_patterns = [
        r"^\s*(hi|hello|hey|thanks|thank you)",
        r"^\s*(how are you|what'?s up)",
        r"^\s*https?://",  # bare URLs
    ]
    for p in non_claim_patterns:
        if re.match(p, claim_lower):
            return False, 0.1

    # Signals of a factual claim
    claim_signals = [
        "percent", "%", "million", "billion", "study", "research",
        "according to", "proven", "causes", "fact", "data shows",
        "statistics", "report", "found that", "evidence",
        "always", "never", "every", "none", "all",
    ]
    score = sum(1 for s in claim_signals if s in claim_lower)
    score = min(score / 3, 1.0)  # normalize to 0-1

    # If it has at least 5 words and some structure, it might be a claim
    words = claim.split()
    if len(words) >= 5:
        score = max(score, 0.4)

    return score >= 0.3, round(score, 2)


# ── Stage 2: Source retrieval ──
async def retrieve_sources(claim: str) -> list[dict]:
    """
    ponytail: query Google Fact Check API + Wikipedia. Add more sources later.
    """
    import httpx
    sources = []

    # Google Fact Check Tools API
    if settings.GOOGLE_FACTCHECK_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://factchecktools.googleapis.com/v1alpha1/claims:search",
                    params={
                        "query": claim[:200],
                        "key": settings.GOOGLE_FACTCHECK_API_KEY,
                        "languageCode": "en",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("claims", [])[:3]:
                        review = (item.get("claimReview") or [{}])[0]
                        sources.append({
                            "title": review.get("title", item.get("text", "Fact Check")),
                            "url": review.get("url", ""),
                            "snippet": review.get("textualRating", ""),
                        })
        except Exception:
            pass  # ponytail: best-effort, don't fail verification

    # Wikipedia search
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Extract key terms (first 5 significant words)
            words = [w for w in claim.split() if len(w) > 3][:5]
            query = " ".join(words)
            resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srlimit": 2,
                    "format": "json",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("query", {}).get("search", []):
                    title = item.get("title", "")
                    snippet = re.sub(r"<[^>]*>", "", item.get("snippet", ""))
                    sources.append({
                        "title": f"Wikipedia: {title}",
                        "url": f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
                        "snippet": snippet,
                    })
    except Exception:
        pass

    return sources[:3]  # cap at 3


# ── Stage 2: LLM synthesis via Ollama ──
async def synthesize_verdict(claim: str, sources: list[dict]) -> dict:
    """
    ponytail: call Ollama, parse response. If Ollama down, return "needs_context".
    """
    import httpx

    source_text = "\n".join(
        f"- {s['title']}: {s.get('snippet', '')}" for s in sources
    ) or "No external sources found."

    prompt = f"""You are a fact-checking assistant. Analyze this claim against the provided sources.

Claim: "{claim}"

Sources:
{source_text}

Respond in exactly this JSON format (no markdown, no explanation outside JSON):
{{
  "verdict": "likely_true" or "needs_context" or "likely_false",
  "confidence": <integer 0-100>,
  "explanation": "<one sentence, plain language, max 25 words>"
}}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )
            if resp.status_code != 200:
                raise Exception(f"Ollama returned {resp.status_code}")

            raw = resp.json().get("response", "")
            # Extract JSON from response
            json_match = re.search(r'\{[^}]+\}', raw)
            if json_match:
                result = json.loads(json_match.group())
                # Validate verdict
                if result.get("verdict") not in ("likely_true", "needs_context", "likely_false"):
                    result["verdict"] = "needs_context"
                # Clamp confidence
                conf = result.get("confidence")
                if isinstance(conf, (int, float)):
                    result["confidence"] = max(0, min(100, int(conf)))
                else:
                    result["confidence"] = None
                return result
    except Exception:
        pass

    # Fallback
    return {
        "verdict": "needs_context",
        "confidence": None,
        "explanation": "Unable to verify this claim at this time. Please check the sources below.",
    }


# ── Routes ──
@router.post("/verify", response_model=VerifyResponse)
async def verify_claim(
    req: VerifyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start = time.time()
    redis_client = await get_redis()

    # Quota check
    await check_and_increment_quota(user, redis_client)

    # Cache check
    claim_hash = hashlib.sha256(req.claim_text.strip().lower().encode()).hexdigest()
    cache_key = f"verify:{claim_hash}"
    cached = await redis_client.get(cache_key)
    if cached:
        result = json.loads(cached)
        result["latency_ms"] = int((time.time() - start) * 1000)
        return VerifyResponse(**result)

    # Stage 1: claim-worthiness
    worthy, score = is_checkworthy(req.claim_text)
    if not worthy:
        result = {
            "verdict": "needs_context",
            "confidence": None,
            "explanation": "This text doesn't appear to contain a verifiable factual claim.",
            "sources": [],
            "latency_ms": int((time.time() - start) * 1000),
        }
        return VerifyResponse(**result)

    # Stage 2: retrieve + synthesize
    sources = await retrieve_sources(req.claim_text)
    verdict_data = await synthesize_verdict(req.claim_text, sources)

    result = {
        "verdict": verdict_data["verdict"],
        "confidence": verdict_data.get("confidence"),
        "explanation": verdict_data.get("explanation", ""),
        "sources": [SourceItem(**s) for s in sources],
        "latency_ms": int((time.time() - start) * 1000),
    }

    # Cache for 24h
    cache_data = {
        "verdict": result["verdict"],
        "confidence": result["confidence"],
        "explanation": result["explanation"],
        "sources": [s.model_dump() for s in result["sources"]],
    }
    await redis_client.set(cache_key, json.dumps(cache_data), ex=86400)

    return VerifyResponse(**result)


@router.post("/feedback", status_code=204)
async def submit_feedback(
    req: FeedbackRequest,
    user: User = Depends(get_current_user),
):
    # ponytail: log feedback to stdout. Store in DB when analytics matter.
    import logging
    logging.info(f"feedback user={hashlib.sha256(user.id.encode()).hexdigest()[:12]} feedback={req.feedback}")


@router.get("/usage", response_model=UsageResponse)
async def get_usage(user: User = Depends(get_current_user)):
    redis_client = await get_redis()
    today = date.today().isoformat()
    key = f"quota:{user.id}:{today}"
    count = await redis_client.get(key)
    return UsageResponse(
        checks_today=int(count or 0),
        daily_limit=settings.DAILY_CHECK_LIMIT,
        tier=user.tier,
    )
