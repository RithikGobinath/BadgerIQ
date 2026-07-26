"""BadgerIQ API - read-only endpoints over the precomputed snapshot."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.data import Store, load_store, summary

store: Store | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global store
    store = load_store()
    print(f"Snapshot loaded: {store.stats}")
    yield


app = FastAPI(title="BadgerIQ API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # public read-only data; tightened per-deploy via env if needed
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "built_at": store.built_at}


@app.get("/stats")
def stats():
    return {"built_at": store.built_at, **store.stats}


@app.get("/search")
def search(q: str = Query(min_length=1, max_length=80), limit: int = Query(20, le=50)):
    return {"results": store.search(q, limit)}


@app.get("/courses/{uuid}")
def course_detail(uuid: str):
    course = store.by_uuid.get(uuid)
    if course is None:
        raise HTTPException(404, "course not found")
    return course


@app.get("/subjects")
def subjects():
    return {"subjects": [{"code": code, "name": name} for code, name in store.subjects]}


@app.get("/rankings")
def rankings(
    order: str = Query("hardest", pattern="^(hardest|easiest)$"),
    subject: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    ranked = [c for c in store.courses if c.get("difficulty_rank") is not None]
    if subject:
        ranked = [c for c in ranked if c["subject_code"] == subject]
    ranked.sort(key=lambda c: c["difficulty_rank"], reverse=(order == "easiest"))
    return {
        "total": len(ranked),
        "results": [summary(c) for c in ranked[offset : offset + limit]],
    }


@app.get("/flags")
def flags(
    type: str | None = Query(None, pattern="^(harsh|inconsistent)$"),
    subject: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    rows = store.flags
    if type:
        rows = [f for f in rows if f["type"] == type]
    if subject:
        by_uuid = store.by_uuid
        rows = [f for f in rows if by_uuid.get(f["course_uuid"], {}).get("subject_code") == subject]
    return {"total": len(rows), "results": rows[offset : offset + limit]}
