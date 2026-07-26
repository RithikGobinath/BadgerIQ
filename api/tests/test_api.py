import json

import pytest
from fastapi.testclient import TestClient

FIXTURE = {
    "built_at": "2026-07-26",
    "stats": {"courses": 2, "ranked_courses": 2, "instructors": 2, "flags": 1, "terms": "x"},
    "courses": [
        {
            "uuid": "u1", "code": "COMP SCI 540", "name": "Intro to Artificial Intelligence",
            "subject": "Computer Sciences", "subject_code": "266", "gpa": 3.2, "enrollment": 5000,
            "pct_a": 0.5, "n_terms": 20, "last_term": 1262, "last_term_label": "Fall 2025",
            "dist": {"a": 2500, "ab": 1000, "b": 1000, "bc": 300, "c": 150, "d": 30, "f": 20},
            "instructors": [], "difficulty_rank": 2, "difficulty_pctl": 0.4,
        },
        {
            "uuid": "u2", "code": "MATH 521", "name": "Analysis I",
            "subject": "Mathematics", "subject_code": "600", "gpa": 2.9, "enrollment": 3000,
            "pct_a": 0.3, "n_terms": 25, "last_term": 1262, "last_term_label": "Fall 2025",
            "dist": {"a": 900, "ab": 600, "b": 800, "bc": 400, "c": 200, "d": 60, "f": 40},
            "instructors": [], "difficulty_rank": 1, "difficulty_pctl": 1.0,
        },
    ],
    "flags": [
        {"type": "harsh", "instructor": "X", "course_uuid": "u2", "course_code": "MATH 521",
         "gpa": 2.4, "subject_avg": 3.0, "reason": "..."}
    ],
}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    p = tmp_path / "snap.json"
    p.write_text(json.dumps(FIXTURE))
    monkeypatch.setenv("SNAPSHOT_LOCAL_PATH", str(p))
    from app.main import app

    with TestClient(app) as c:
        yield c


def test_search_prefix_beats_name_match(client):
    r = client.get("/search", params={"q": "comp sci"}).json()
    assert r["results"][0]["code"] == "COMP SCI 540"
    r = client.get("/search", params={"q": "analysis"}).json()
    assert r["results"][0]["code"] == "MATH 521"


def test_course_detail_and_404(client):
    assert client.get("/courses/u1").json()["code"] == "COMP SCI 540"
    assert client.get("/courses/nope").status_code == 404


def test_rankings_order_and_subject_filter(client):
    hardest = client.get("/rankings").json()
    assert hardest["results"][0]["code"] == "MATH 521"
    easiest = client.get("/rankings", params={"order": "easiest"}).json()
    assert easiest["results"][0]["code"] == "COMP SCI 540"
    math_only = client.get("/rankings", params={"subject": "600"}).json()
    assert math_only["total"] == 1


def test_flags_filter(client):
    assert client.get("/flags").json()["total"] == 1
    assert client.get("/flags", params={"type": "inconsistent"}).json()["total"] == 0
    assert client.get("/flags", params={"subject": "600"}).json()["total"] == 1
