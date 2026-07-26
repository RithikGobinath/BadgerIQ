"""Build the BadgerIQ data snapshot from the CourseIQ BigQuery tables.

Runs weekly (after CourseIQ's Monday refresh) and precomputes everything the
API serves, so no request ever touches BigQuery:

- per-course summaries: enrollment-weighted GPA, grade distribution,
  per-instructor breakdowns with RMP ratings and per-term GPA trends
- a difficulty index: courses ranked by weighted GPA, gated on minimum
  enrollment/offerings so tiny sections don't dominate the extremes
- advising flags: rule-based (not ML), each with its stated reason -
  "harsh" (instructor sits far below their subject's average) and
  "inconsistent" (large term-to-term GPA swings)

Output: one JSON document uploaded to GCS (dated copy + latest.json).
"""
from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

import pandas as pd
from google.cloud import bigquery, storage

GRADE_POINTS = {"a": 4.0, "ab": 3.5, "b": 3.0, "bc": 2.5, "c": 2.0, "d": 1.0, "f": 0.0}
GRADE_KEYS = list(GRADE_POINTS)

# Eligibility gates - keep noise out of rankings and flags
RANKING_MIN_ENROLLMENT = 100
RANKING_MIN_TERMS = 3
FLAG_MIN_ENROLLMENT = 50
HARSH_STD_BELOW = 1.0
INCONSISTENT_MIN_TERMS = 4
INCONSISTENT_GPA_STD = 0.3

TERM_SEMESTERS = {2: "Fall", 4: "Spring", 6: "Summer"}


def term_label(term_code: int) -> str:
    """1244 -> 'Spring 2024'. Same UW registrar scheme CourseIQ validated."""
    century = term_code // 1000
    year_end = 1900 + century * 100 + (term_code // 10) % 100
    sem = TERM_SEMESTERS.get(term_code % 10, "?")
    year = year_end - 1 if sem == "Fall" else year_end
    return f"{sem} {year}"


def weighted_gpa(row_or_df) -> float | None:
    graded = sum(row_or_df[k] for k in GRADE_KEYS)
    if not graded:
        return None
    pts = sum(row_or_df[k] * p for k, p in GRADE_POINTS.items())
    return round(pts / graded, 3)


def load_frames(project: str, dataset: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Pull pre-aggregated frames from BigQuery (instructor x course x term grain)."""
    bq = bigquery.Client(project=project)
    grades_sql = f"""
        SELECT
          course_uuid, term_code, instructor_name,
          SUM(a_count) a, SUM(ab_count) ab, SUM(b_count) b, SUM(bc_count) bc,
          SUM(c_count) c, SUM(d_count) d, SUM(f_count) f
        FROM `{project}.{dataset}.grade_distributions`
        GROUP BY course_uuid, term_code, instructor_name
    """
    courses_sql = f"""
        SELECT uuid, number, name, subject_code, subject_name, subject_abbreviation
        FROM `{project}.{dataset}.courses`
    """
    rmp_sql = f"""
        SELECT m.madgrades_instructor_name, r.avg_rating, r.avg_difficulty,
               r.would_take_again_percent, r.num_ratings
        FROM `{project}.{dataset}.instructor_match` m
        JOIN `{project}.{dataset}.rmp_ratings` r ON m.rmp_id = r.rmp_id
        WHERE m.rmp_id IS NOT NULL
    """
    return (
        bq.query(grades_sql).to_dataframe(),
        bq.query(courses_sql).to_dataframe(),
        bq.query(rmp_sql).to_dataframe(),
    )


def build_snapshot(grades: pd.DataFrame, courses: pd.DataFrame, rmp: pd.DataFrame) -> dict:
    grades = grades.dropna(subset=["instructor_name"]).copy()
    grades["graded"] = grades[GRADE_KEYS].sum(axis=1)
    grades = grades[grades["graded"] > 0]
    grades["gpa"] = grades.apply(weighted_gpa, axis=1)

    courses = courses.set_index("uuid")
    # RMP pagination can return the same teacher on two pages, and the fuzzy
    # match can map one Madgrades name to the same RMP record twice - keep
    # the row with the most ratings for each name.
    rmp = rmp.sort_values("num_ratings", ascending=False).drop_duplicates("madgrades_instructor_name")
    rmp_by_name = rmp.set_index("madgrades_instructor_name").to_dict("index")

    course_entries = []
    flag_entries = []
    # subject-level stats for flagging, built from instructor-course units
    inst_course = (
        grades.groupby(["course_uuid", "instructor_name"])
        .agg(**{k: (k, "sum") for k in GRADE_KEYS}, graded=("graded", "sum"), n_terms=("term_code", "nunique"))
        .reset_index()
    )
    inst_course["gpa"] = inst_course.apply(weighted_gpa, axis=1)
    inst_course["subject_code"] = inst_course["course_uuid"].map(courses["subject_code"])

    eligible_units = inst_course[inst_course["graded"] >= FLAG_MIN_ENROLLMENT]
    subject_stats = (
        eligible_units.groupby("subject_code")["gpa"].agg(["mean", "std", "count"]).rename(
            columns={"mean": "sub_mean", "std": "sub_std", "count": "sub_n"}
        )
    )

    for uuid, cgrades in grades.groupby("course_uuid"):
        if uuid not in courses.index:
            continue
        meta = courses.loc[uuid]
        code = f"{meta['subject_abbreviation']} {meta['number']}"
        totals = {k: int(cgrades[k].sum()) for k in GRADE_KEYS}
        course_gpa = weighted_gpa(totals)
        graded_total = sum(totals.values())

        instructors = []
        for iname, ig in cgrades.groupby("instructor_name"):
            idist = {k: int(ig[k].sum()) for k in GRADE_KEYS}
            igpa = weighted_gpa(idist)
            trend = sorted(
                [[int(t), g] for t, g in ig.groupby("term_code")["gpa"].first().items() if g is not None]
            )
            rmp_row = rmp_by_name.get(iname)
            instructors.append(
                {
                    "name": iname.title(),
                    "gpa": igpa,
                    "enrollment": int(sum(idist.values())),
                    "n_terms": int(ig["term_code"].nunique()),
                    "dist": idist,
                    "trend": trend,
                    "rmp": (
                        {
                            "rating": rmp_row["avg_rating"],
                            "difficulty": rmp_row["avg_difficulty"],
                            "would_take_again": rmp_row["would_take_again_percent"],
                            "n_ratings": int(rmp_row["num_ratings"]),
                        }
                        if rmp_row
                        else None
                    ),
                }
            )
        instructors.sort(key=lambda i: -i["enrollment"])

        last_term = int(cgrades["term_code"].max())
        course_entries.append(
            {
                "uuid": uuid,
                "code": code,
                "name": meta["name"],
                "subject": meta["subject_name"],
                "subject_code": meta["subject_code"],
                "gpa": course_gpa,
                "enrollment": graded_total,
                "pct_a": round(totals["a"] / graded_total, 4) if graded_total else None,
                "n_terms": int(cgrades["term_code"].nunique()),
                "last_term": last_term,
                "last_term_label": term_label(last_term),
                "dist": totals,
                "instructors": instructors,
            }
        )

    # ---- difficulty rankings ----
    ranked = [
        c for c in course_entries
        if c["gpa"] is not None
        and c["enrollment"] >= RANKING_MIN_ENROLLMENT
        and c["n_terms"] >= RANKING_MIN_TERMS
    ]
    ranked.sort(key=lambda c: c["gpa"])
    for i, c in enumerate(ranked):
        c["difficulty_rank"] = i + 1
        c["difficulty_pctl"] = round(1 - i / len(ranked), 4)  # 1.0 = hardest

    # ---- advising flags ----
    for _, unit in eligible_units.iterrows():
        sub = subject_stats.loc[unit["subject_code"]] if unit["subject_code"] in subject_stats.index else None
        if sub is None or sub["sub_n"] < 10 or pd.isna(sub["sub_std"]) or sub["sub_std"] == 0:
            continue
        meta = courses.loc[unit["course_uuid"]] if unit["course_uuid"] in courses.index else None
        if meta is None:
            continue
        code = f"{meta['subject_abbreviation']} {meta['number']}"
        if unit["gpa"] < sub["sub_mean"] - HARSH_STD_BELOW * sub["sub_std"] and unit["n_terms"] >= 2:
            flag_entries.append(
                {
                    "type": "harsh",
                    "instructor": unit["instructor_name"].title(),
                    "course_uuid": unit["course_uuid"],
                    "course_code": code,
                    "gpa": unit["gpa"],
                    "subject_avg": round(sub["sub_mean"], 3),
                    "reason": (
                        f"Average GPA {unit['gpa']:.2f} is more than {HARSH_STD_BELOW:.0f} standard deviation"
                        f" below the {meta['subject_name']} average of {sub['sub_mean']:.2f}"
                        f" (across {int(unit['n_terms'])} terms, {int(unit['graded'])} graded students)"
                    ),
                }
            )

    per_term = grades.groupby(["course_uuid", "instructor_name"])["gpa"].agg(["std", "count"])
    for (uuid, iname), row in per_term.iterrows():
        if row["count"] >= INCONSISTENT_MIN_TERMS and row["std"] and row["std"] > INCONSISTENT_GPA_STD:
            unit = inst_course[(inst_course["course_uuid"] == uuid) & (inst_course["instructor_name"] == iname)]
            if unit.empty or unit.iloc[0]["graded"] < FLAG_MIN_ENROLLMENT or uuid not in courses.index:
                continue
            meta = courses.loc[uuid]
            flag_entries.append(
                {
                    "type": "inconsistent",
                    "instructor": iname.title(),
                    "course_uuid": uuid,
                    "course_code": f"{meta['subject_abbreviation']} {meta['number']}",
                    "gpa": unit.iloc[0]["gpa"],
                    "gpa_std": round(row["std"], 3),
                    "reason": (
                        f"Term-to-term GPA varies widely (std {row['std']:.2f} across {int(row['count'])} terms)"
                        f" - the same course with the same instructor has swung significantly between semesters"
                    ),
                }
            )

    flag_entries.sort(key=lambda f: f.get("gpa") or 0)

    return {
        "stats": {
            "courses": len(course_entries),
            "ranked_courses": len(ranked),
            "instructors": int(grades["instructor_name"].nunique()),
            "flags": len(flag_entries),
            "terms": f"{term_label(int(grades['term_code'].min()))} - {term_label(int(grades['term_code'].max()))}",
        },
        "courses": course_entries,
        "flags": flag_entries,
    }


def upload(doc: dict, bucket_name: str, project: str, run_date: str) -> None:
    client = storage.Client(project=project)
    bucket = client.bucket(bucket_name)
    payload = json.dumps(doc, default=str)
    for name in (f"snapshots/v{run_date}.json", "snapshots/latest.json"):
        blob = bucket.blob(name)
        blob.content_encoding = None
        blob.upload_from_string(payload, content_type="application/json")
        print(f"Uploaded gs://{bucket_name}/{name} ({len(payload) / 1e6:.1f} MB)")


def run() -> None:
    project = os.environ["GCP_PROJECT_ID"]
    dataset = os.environ.get("BQ_DATASET", "courseiq")
    bucket = os.environ.get("GCS_BUCKET_SNAPSHOT", "badgeriq-snapshots")

    print("Querying BigQuery...")
    grades, courses, rmp = load_frames(project, dataset)
    print(f"  {len(grades)} instructor-course-term rows, {len(courses)} courses, {len(rmp)} RMP matches")

    print("Building snapshot...")
    doc = build_snapshot(grades, courses, rmp)
    doc["built_at"] = date.today().isoformat()
    print(f"  {doc['stats']}")

    local = Path("api/snapshot/latest.json") if Path("api").exists() else Path("snapshot/latest.json")
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_text(json.dumps(doc, default=str))
    print(f"Wrote {local}")

    upload(doc, bucket, project, date.today().strftime("%Y%m%d"))


if __name__ == "__main__":
    run()
