from snapshot.enroll_join import attach_to_courses, build_enroll_index, _ms_to_clock


CATALOG = [
    {
        "termCode": "1272",
        "courseId": "024795",
        "subject": {"subjectCode": "266", "description": "COMPUTER SCIENCES"},
        "catalogNumber": "300",
        "title": "Programming II",
        "description": "Intro to OOP and data structures.",
        "minimumCredits": 3,
        "maximumCredits": 3,
        "creditRange": "3",
        "currentlyTaught": True,
        "enrollmentPrerequisites": "COMP SCI 200 or 220",
        "advisoryPrerequisites": None,
        "generalEd": None,
        "ethnicStudies": None,
        "breadths": [{"description": "Natural Science"}],
        "coreGeneralEducation": None,
    },
    {
        # a course with no live offering this term (e.g. summer-only, but we
        # only pulled enrollment packages for the fall course above)
        "termCode": "1272",
        "courseId": "000001",
        "subject": {"subjectCode": "600", "description": "MATHEMATICS"},
        "catalogNumber": "521",
        "title": "Analysis I",
        "description": "Real analysis.",
        "minimumCredits": 4,
        "maximumCredits": 4,
        "creditRange": "4",
        "currentlyTaught": True,
        "enrollmentPrerequisites": "MATH 375",
        "advisoryPrerequisites": None,
        "generalEd": None,
        "ethnicStudies": None,
        "breadths": [],
        "coreGeneralEducation": None,
    },
]

ENROLLMENT_PACKAGES = [
    {
        "term_code": "1272",
        "subject_code": "266",
        "course_id": "024795",
        "packages": [
            {
                "packageEnrollmentStatus": {"availableSeats": 7, "waitlistTotal": 0, "status": "OPEN"},
                "sections": [
                    {
                        "type": "LEC",
                        "sectionNumber": "002",
                        "instructionMode": "Classroom Instruction",
                        "classMeetings": [
                            {
                                "meetingType": "CLASS",
                                "meetingTimeStart": 73500000,
                                "meetingTimeEnd": 76500000,
                                "meetingDays": "MWF",
                                "meetingDaysList": ["MONDAY", "WEDNESDAY", "FRIDAY"],
                                "building": {"buildingName": "Mosse Humanities Building"},
                                "room": "2650",
                            },
                            {
                                "meetingType": "EXAM",
                                "examDate": 1797055200000,
                                "meetingTimeStart": 66300000,
                                "meetingTimeEnd": 73500000,
                            },
                        ],
                        "instructor": {"name": {"first": "Cole", "last": "Nelson"}, "netid": "CTNELSON2"},
                    }
                ],
            }
        ],
    }
]


def fake_term_label(term_code: int) -> str:
    return "Fall 2026" if term_code == 1272 else str(term_code)


def test_ms_to_clock():
    assert _ms_to_clock(73_500_000) == "20:25"
    assert _ms_to_clock(28_800_000) == "08:00"
    assert _ms_to_clock(None) is None


def test_build_index_and_attach_matches_by_subject_and_number():
    index = build_enroll_index(CATALOG, ENROLLMENT_PACKAGES, fake_term_label)
    courses = [
        {"subject_code": "266", "number": 300, "code": "COMP SCI 300"},
        {"subject_code": "600", "number": 521, "code": "MATH 521"},
        {"subject_code": "999", "number": 1, "code": "NOT IN CATALOG 1"},
    ]
    matched = attach_to_courses(courses, index)

    assert matched == 2
    cs300 = courses[0]["catalog"]
    assert cs300["description"] == "Intro to OOP and data structures."
    assert cs300["prerequisites"]["enrollment"] == "COMP SCI 200 or 220"
    assert cs300["gen_ed"]["breadths"] == ["Natural Science"]

    offering = cs300["current_offering"]
    assert offering["term_label"] == "Fall 2026"
    section = offering["sections"][0]
    assert section["seats"] == {"available": 7, "waitlist": 0, "status": "OPEN"}
    assert section["meetings"] == [
        {
            "days": "MWF",
            "days_list": ["MONDAY", "WEDNESDAY", "FRIDAY"],
            "start": "20:25",
            "end": "21:15",
            "building": "Mosse Humanities Building",
            "room": "2650",
        }
    ]
    assert section["instructor"] == "Cole Nelson"
    assert section["final_exam_date"] == 1797055200000

    # MATH 521 is in the catalog (has prereqs/description) but has no live
    # enrollment package in the fixture - current_offering should be None,
    # not crash or silently drop the catalog fields.
    math521 = courses[1]["catalog"]
    assert math521["prerequisites"]["enrollment"] == "MATH 375"
    assert math521["current_offering"] is None

    assert courses[2]["catalog"] is None


def test_unmatched_course_keeps_catalog_field_none():
    index = build_enroll_index(CATALOG, ENROLLMENT_PACKAGES, fake_term_label)
    courses = [{"subject_code": "104", "number": 101, "code": "AFRICAN 101"}]
    matched = attach_to_courses(courses, index)
    assert matched == 0
    assert courses[0]["catalog"] is None
