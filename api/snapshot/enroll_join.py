"""Join enroll.wisc.edu catalog + live enrollment data onto course records.

Two-step key resolution, because the two enroll.wisc.edu payloads don't
share the same key: the catalog is keyed by (subjectCode, catalogNumber),
but the live enrollmentPackages payload only carries courseId (not
catalogNumber) alongside subjectCode. So course_id -> catalog entry is
resolved first, then that entry's catalogNumber is used to join onto
BadgerIQ's existing course records (subject_code, number) - the same keys
Madgrades/CourseIQ already use.
"""
from __future__ import annotations

from datetime import datetime, timezone

CLASS_MEETING = "CLASS"
EXAM_MEETING = "EXAM"


def _ms_to_clock(ms: int | None) -> str | None:
    """Milliseconds since midnight -> 'HH:MM'."""
    if ms is None:
        return None
    total_min = ms // 60000
    return f"{total_min // 60:02d}:{total_min % 60:02d}"


def index_catalog_by_course_id(catalog: list[dict]) -> dict[str, dict]:
    """course_id -> catalog entry, preferring the latest (largest) term_code
    on collision - most-current data wins if a course appears in >1 open term."""
    by_id: dict[str, dict] = {}
    for entry in sorted(catalog, key=lambda c: c.get("termCode", "")):
        by_id[entry["courseId"]] = entry
    return by_id


def index_catalog_by_subject_number(catalog: list[dict]) -> dict[tuple[str, str], dict]:
    by_key: dict[tuple[str, str], dict] = {}
    for entry in sorted(catalog, key=lambda c: c.get("termCode", "")):
        key = (entry["subject"]["subjectCode"], str(entry["catalogNumber"]))
        by_key[key] = entry
    return by_key


def extract_gen_ed(entry: dict) -> dict:
    return {
        "general_ed": entry.get("generalEd"),
        "ethnic_studies": entry.get("ethnicStudies"),
        "breadths": [b.get("description") if isinstance(b, dict) else b for b in (entry.get("breadths") or [])],
        "core_general_education": entry.get("coreGeneralEducation"),
    }


def extract_prerequisites(entry: dict) -> dict:
    return {
        "enrollment": entry.get("enrollmentPrerequisites"),
        "advisory": entry.get("advisoryPrerequisites"),
    }


def _extract_sections(packages: list[dict]) -> list[dict]:
    sections = []
    for pkg in packages:
        status = pkg.get("packageEnrollmentStatus") or {}
        seats = {
            "available": status.get("availableSeats"),
            "waitlist": status.get("waitlistTotal"),
            "status": status.get("status"),
        }
        for sec in pkg.get("sections", []):
            class_meetings = [m for m in sec.get("classMeetings", []) if m.get("meetingType") == CLASS_MEETING]
            exam = next((m for m in sec.get("classMeetings", []) if m.get("meetingType") == EXAM_MEETING), None)
            instructor = sec.get("instructor") or {}
            name = instructor.get("name") or {}
            sections.append(
                {
                    "section_number": sec.get("sectionNumber"),
                    "type": sec.get("type"),
                    "instruction_mode": sec.get("instructionMode"),
                    "instructor": " ".join(filter(None, [name.get("first"), name.get("last")])) or None,
                    "seats": seats,
                    "meetings": [
                        {
                            "days": m.get("meetingDays"),
                            "start": _ms_to_clock(m.get("meetingTimeStart")),
                            "end": _ms_to_clock(m.get("meetingTimeEnd")),
                            "building": (m.get("building") or {}).get("buildingName"),
                            "room": m.get("room"),
                        }
                        for m in class_meetings
                    ],
                    "final_exam_date": exam.get("examDate") if exam else None,
                }
            )
    return sections


def build_enroll_index(
    catalog: list[dict], enrollment_packages: list[dict], term_label_fn
) -> dict[tuple[str, str], dict]:
    """Return {(subject_code, catalog_number): {catalog fields..., "current_offering": {...} | None}}."""
    by_course_id = index_catalog_by_course_id(catalog)
    by_subject_number = index_catalog_by_subject_number(catalog)

    offerings: dict[tuple[str, str], dict] = {}
    for pkg_entry in enrollment_packages:
        catalog_entry = by_course_id.get(pkg_entry["course_id"])
        if catalog_entry is None:
            continue
        key = (catalog_entry["subject"]["subjectCode"], str(catalog_entry["catalogNumber"]))
        term_code = int(pkg_entry["term_code"])
        offerings[key] = {
            "term_code": term_code,
            "term_label": term_label_fn(term_code),
            "sections": _extract_sections(pkg_entry["packages"]),
            "last_checked": datetime.now(timezone.utc).isoformat(),
        }

    index: dict[tuple[str, str], dict] = {}
    for key, entry in by_subject_number.items():
        credit_min, credit_max = entry.get("minimumCredits"), entry.get("maximumCredits")
        index[key] = {
            "description": entry.get("description"),
            "credits": {"min": credit_min, "max": credit_max, "range": entry.get("creditRange")},
            "prerequisites": extract_prerequisites(entry),
            "gen_ed": extract_gen_ed(entry),
            "current_offering": offerings.get(key),
        }
    return index


def attach_to_courses(course_entries: list[dict], enroll_index: dict[tuple[str, str], dict]) -> int:
    """Mutate each course entry in place with a matching enroll_index record.
    Returns the number of courses matched, for logging/sanity-checking."""
    matched = 0
    for course in course_entries:
        key = (course["subject_code"], str(course["number"]))
        enrich = enroll_index.get(key)
        if enrich is None:
            course["catalog"] = None
            continue
        course["catalog"] = enrich
        matched += 1
    return matched
