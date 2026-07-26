import pandas as pd

from snapshot.build import build_snapshot, term_label, weighted_gpa


def make_frames():
    # course X: instructor HARSH GRADER gives mostly C's; three easy instructors give A's
    rows = []
    for term in (1244, 1252, 1254, 1262):
        rows.append({"course_uuid": "x", "term_code": term, "instructor_name": "HARSH GRADER",
                     "a": 5, "ab": 5, "b": 10, "bc": 10, "c": 20, "d": 5, "f": 5})
        for i in range(3):
            rows.append({"course_uuid": "x", "term_code": term, "instructor_name": f"EASY {i}",
                         "a": 55, "ab": 3, "b": 2, "bc": 0, "c": 0, "d": 0, "f": 0})
    # a second course so the subject has >= 10 eligible units - pad with easy instructors
    for i in range(8):
        for term in (1244, 1252):
            rows.append({"course_uuid": "y", "term_code": term, "instructor_name": f"PAD {i}",
                         "a": 50, "ab": 5, "b": 5, "bc": 0, "c": 0, "d": 0, "f": 0})
    grades = pd.DataFrame(rows)
    courses = pd.DataFrame([
        {"uuid": "x", "number": 101, "name": "Intro", "subject_code": "266",
         "subject_name": "Computer Sciences", "subject_abbreviation": "COMP SCI"},
        {"uuid": "y", "number": 200, "name": "Second", "subject_code": "266",
         "subject_name": "Computer Sciences", "subject_abbreviation": "COMP SCI"},
    ])
    rmp = pd.DataFrame([
        {"madgrades_instructor_name": "HARSH GRADER", "avg_rating": 2.1,
         "avg_difficulty": 4.5, "would_take_again_percent": 30.0, "num_ratings": 25},
    ])
    return grades, courses, rmp


def test_weighted_gpa():
    assert weighted_gpa({"a": 10, "ab": 0, "b": 0, "bc": 0, "c": 0, "d": 0, "f": 0}) == 4.0
    assert weighted_gpa({"a": 5, "ab": 0, "b": 5, "bc": 0, "c": 0, "d": 0, "f": 0}) == 3.5
    assert weighted_gpa({"a": 0, "ab": 0, "b": 0, "bc": 0, "c": 0, "d": 0, "f": 0}) is None


def test_term_label():
    assert term_label(1244) == "Spring 2024"
    assert term_label(1092) == "Fall 2008"


def test_snapshot_flags_harsh_grader_and_attaches_rmp():
    doc = build_snapshot(*make_frames())
    harsh = [f for f in doc["flags"] if f["type"] == "harsh"]
    assert any(f["instructor"] == "Harsh Grader" and f["course_code"] == "COMP SCI 101" for f in harsh)

    course_x = next(c for c in doc["courses"] if c["uuid"] == "x")
    harsh_inst = next(i for i in course_x["instructors"] if i["name"] == "Harsh Grader")
    assert harsh_inst["rmp"]["difficulty"] == 4.5
    easy_inst = next(i for i in course_x["instructors"] if i["name"].startswith("Easy"))
    assert easy_inst["rmp"] is None
    assert easy_inst["gpa"] > harsh_inst["gpa"]


def test_rankings_gated_by_enrollment_and_terms():
    doc = build_snapshot(*make_frames())
    course_x = next(c for c in doc["courses"] if c["uuid"] == "x")
    course_y = next(c for c in doc["courses"] if c["uuid"] == "y")
    assert "difficulty_rank" in course_x       # 4 terms, plenty of enrollment
    assert "difficulty_rank" not in course_y   # only 2 terms - gated out
