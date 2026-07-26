"""Snapshot loading + in-memory indices for the API.

The whole snapshot (~19MB JSON) is loaded once at startup and served from
memory - requests never touch BigQuery or GCS. SNAPSHOT_LOCAL_PATH points
at a local file for dev; otherwise the latest snapshot is pulled from GCS.
"""
from __future__ import annotations

import json
import os
from pathlib import Path


class Store:
    def __init__(self, doc: dict):
        self.built_at: str = doc.get("built_at", "")
        self.stats: dict = doc["stats"]
        self.courses: list[dict] = doc["courses"]
        self.flags: list[dict] = doc["flags"]

        self.by_uuid: dict[str, dict] = {c["uuid"]: c for c in self.courses}
        # search rows: (lowercased code, lowercased name, course)
        self._search_rows = [(c["code"].lower(), (c["name"] or "").lower(), c) for c in self.courses]
        self.subjects: list[dict] = sorted(
            {(c["subject_code"], c["subject"]) for c in self.courses if c["subject"]},
            key=lambda s: s[1],
        )

    def search(self, q: str, limit: int = 20) -> list[dict]:
        q = q.strip().lower()
        if not q:
            return []
        scored: list[tuple[float, dict]] = []
        for code, name, course in self._search_rows:
            if code.startswith(q):
                score = 3.0
            elif q in code:
                score = 2.0
            elif q in name:
                score = 1.0
            else:
                # multi-word: every word must appear somewhere
                words = q.split()
                if len(words) > 1 and all(w in code or w in name for w in words):
                    score = 0.5
                else:
                    continue
            # enrollment as tiebreak - big well-known courses first
            scored.append((score + min(course["enrollment"], 100_000) / 1e6, course))
        scored.sort(key=lambda t: -t[0])
        return [summary(c) for _, c in scored[:limit]]


def summary(c: dict) -> dict:
    """Light course row for search results and rankings."""
    return {
        "uuid": c["uuid"],
        "code": c["code"],
        "name": c["name"],
        "subject": c["subject"],
        "gpa": c["gpa"],
        "enrollment": c["enrollment"],
        "pct_a": c["pct_a"],
        "n_terms": c["n_terms"],
        "last_term_label": c["last_term_label"],
        "difficulty_rank": c.get("difficulty_rank"),
        "difficulty_pctl": c.get("difficulty_pctl"),
    }


def load_store() -> Store:
    local = os.environ.get("SNAPSHOT_LOCAL_PATH")
    if local and Path(local).exists():
        print(f"Loading snapshot from {local}")
        return Store(json.loads(Path(local).read_text()))

    from google.cloud import storage

    project = os.environ["GCP_PROJECT_ID"]
    bucket = os.environ.get("GCS_BUCKET_SNAPSHOT", "badgeriq-snapshots")
    print(f"Loading snapshot from gs://{bucket}/snapshots/latest.json")
    blob = storage.Client(project=project).bucket(bucket).blob("snapshots/latest.json")
    return Store(json.loads(blob.download_as_text()))
