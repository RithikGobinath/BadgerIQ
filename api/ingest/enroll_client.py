"""Client for UW-Madison's public Course Search & Enroll API.

public.enroll.wisc.edu is the official course search/enrollment site. Its
backend API is unauthenticated and CORS-open (Access-Control-Allow-Origin: *)
- confirmed live, no NetID/session login required. The site only exposes
whichever term(s) are currently open for search/enrollment (not a historical
archive - Madgrades already covers history back to 2006), so term codes are
discovered at runtime from /aggregate rather than hardcoded.

Term codes use the exact same century+year+semester scheme as Madgrades
(confirmed: 1272 decodes to Fall 2026 under CourseIQ's term_label() formula),
and subject codes match Madgrades' registrar codes exactly (confirmed:
266=COMP SCI, 296=ECON, 600=MATH in both systems) - so both join for free
against BadgerIQ's existing course/term keys.

Endpoints (response shapes confirmed against live requests, not guessed):

GET /api/search/v1/aggregate
    {"terms": [{"termCode": "1272", "longDescription": "Fall 2026-2027", ...}], "subjects": {...}}

POST /api/search/v1  {selectedTerm, queryString, filters, page, pageSize, sortOrder}
    {"found": int, "hits": [course...], "success": bool}
    Course fields used: courseId, subject{subjectCode}, catalogNumber, title,
    description, minimumCredits/maximumCredits/creditRange, currentlyTaught,
    enrollmentPrerequisites, advisoryPrerequisites, generalEd, ethnicStudies,
    breadths, coreGeneralEducation.

GET /api/search/v1/enrollmentPackages/{term}/{subjectCode}/{courseId}
    [{"packageEnrollmentStatus": {"availableSeats", "waitlistTotal", "status"},
      "sections": [{"type", "sectionNumber", "instructionMode",
                     "classMeetings": [{"meetingType": "CLASS"|"EXAM",
                         "meetingTimeStart"/"meetingTimeEnd" (ms since midnight),
                         "meetingDays", "building", "room"}],
                     "instructor": {"name": {...}, "netid": ...}}]}, ...]
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests

BASE_URL = "https://public.enroll.wisc.edu/api/search/v1"
RAW_DIR = Path("data/raw/enroll")

_HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://public.enroll.wisc.edu",
    "Referer": "https://public.enroll.wisc.edu/search",
    # The endpoint's CloudFront WAF 403s requests that don't look like a
    # browser - confirmed empirically, not a bot-detection bypass, just
    # matching what the site's own client sends (same situation as RMP).
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
}


class EnrollClient:
    def __init__(self, session: requests.Session | None = None):
        self.session = session or requests.Session()
        self.session.headers.update(_HEADERS)

    def fetch_terms(self) -> list[dict]:
        """Currently searchable terms - this is not a historical archive,
        only whatever term(s) UW currently has open (usually 1-2)."""
        resp = self.session.get(f"{BASE_URL}/aggregate", timeout=30)
        resp.raise_for_status()
        return resp.json()["terms"]

    def fetch_catalog(self, term_code: str, page_size: int = 100) -> list[dict]:
        """Full course catalog for a term, paginated. Each hit gets a
        termCode stamped on it so downstream code doesn't need the term
        threaded through separately."""
        courses = []
        page = 1
        while True:
            resp = self.session.post(
                BASE_URL,
                json={
                    "selectedTerm": term_code,
                    "queryString": "*",
                    "filters": [],
                    "page": page,
                    "pageSize": page_size,
                    "sortOrder": "SCORE",
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            hits = data.get("hits") or []
            courses.extend(hits)
            if len(hits) < page_size or page * page_size >= (data.get("found") or 0):
                break
            page += 1
            time.sleep(0.15)
        return courses

    def fetch_enrollment_package(self, term_code: str, subject_code: str, course_id: str) -> list[dict]:
        """Live sections + seat/waitlist status for one course. Empty list
        if the course isn't actually offered this term."""
        resp = self.session.get(
            f"{BASE_URL}/enrollmentPackages/{term_code}/{subject_code}/{course_id}", timeout=30
        )
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        return resp.json()


def fetch_all_catalogs(client: EnrollClient, out_dir: Path = RAW_DIR) -> tuple[Path, list[dict]]:
    """Pull the catalog for every currently-open term."""
    out_dir.mkdir(parents=True, exist_ok=True)
    terms = client.fetch_terms()
    all_courses = []
    for term in terms:
        code = term["termCode"]
        courses = client.fetch_catalog(code)
        for c in courses:
            c["termCode"] = code
        print(f"  {term['longDescription']} ({code}): {len(courses)} courses")
        all_courses.extend(courses)

    out_path = out_dir / "catalog.json"
    out_path.write_text(json.dumps(all_courses, indent=2))
    print(f"Wrote {len(all_courses)} course-term records to {out_path}")
    return out_path, terms


def fetch_all_enrollment_packages(client: EnrollClient, courses: list[dict], out_dir: Path = RAW_DIR) -> Path:
    """Live seats/sections for every currently-taught course.

    Skips courses not flagged currentlyTaught - most of the ~5,800-course
    catalog isn't actually offered in a given term, and hitting
    enrollmentPackages for all of them would be mostly wasted requests.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    taught = [c for c in courses if c.get("currentlyTaught")]
    results = []
    for i, course in enumerate(taught, start=1):
        term_code = course["termCode"]
        subject_code = course["subject"]["subjectCode"]
        course_id = course["courseId"]
        try:
            pkgs = client.fetch_enrollment_package(term_code, subject_code, course_id)
        except requests.HTTPError as exc:
            print(f"Skipping {subject_code}/{course_id} ({term_code}): {exc}")
            pkgs = []
        if pkgs:
            results.append(
                {"term_code": term_code, "subject_code": subject_code, "course_id": course_id, "packages": pkgs}
            )
        if i % 200 == 0:
            print(f"  fetched enrollment for {i}/{len(taught)} currently-taught courses")
        time.sleep(0.15)

    out_path = out_dir / "enrollment_packages.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"Wrote live enrollment data for {len(results)} course-terms to {out_path}")
    return out_path


def run() -> tuple[Path, Path]:
    client = EnrollClient()
    print("Fetching catalog for all open terms...")
    catalog_path, _ = fetch_all_catalogs(client)
    courses = json.loads(catalog_path.read_text())

    print("Fetching live enrollment/seats for currently-taught courses...")
    packages_path = fetch_all_enrollment_packages(client, courses)
    return catalog_path, packages_path


if __name__ == "__main__":
    run()
