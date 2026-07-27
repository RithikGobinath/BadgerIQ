import json

import pytest
import requests

from ingest.enroll_client import EnrollClient, fetch_all_enrollment_packages


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")


class FakeSession:
    """Minimal requests.Session stand-in - no real network calls in unit tests."""

    def __init__(self, pages=None, packages=None):
        self.headers = {}
        self._pages = pages or {}
        self._packages = packages or {}
        self.get_calls = []
        self.post_calls = []

    def post(self, url, json=None, timeout=None):
        self.post_calls.append(json)
        page = json["page"]
        return FakeResponse(self._pages[page])

    def get(self, url, timeout=None):
        self.get_calls.append(url)
        key = url.split("/enrollmentPackages/")[-1] if "enrollmentPackages" in url else None
        if key is not None and key not in self._packages:
            return FakeResponse(None, status_code=404)
        if key is not None:
            return FakeResponse(self._packages[key])
        return FakeResponse({"terms": []})


def test_fetch_catalog_paginates_until_exhausted():
    pages = {
        1: {"found": 5, "hits": [{"courseId": "1"}, {"courseId": "2"}], "success": True},
        2: {"found": 5, "hits": [{"courseId": "3"}, {"courseId": "4"}], "success": True},
        3: {"found": 5, "hits": [{"courseId": "5"}], "success": True},
    }
    client = EnrollClient(session=FakeSession(pages=pages))
    courses = client.fetch_catalog("1272", page_size=2)
    assert [c["courseId"] for c in courses] == ["1", "2", "3", "4", "5"]
    assert len(client.session.post_calls) == 3


def test_fetch_catalog_single_page():
    pages = {1: {"found": 1, "hits": [{"courseId": "only"}], "success": True}}
    client = EnrollClient(session=FakeSession(pages=pages))
    courses = client.fetch_catalog("1272", page_size=50)
    assert len(courses) == 1
    assert len(client.session.post_calls) == 1


def test_enrollment_packages_skips_not_currently_taught(tmp_path):
    courses = [
        {"termCode": "1272", "subject": {"subjectCode": "266"}, "courseId": "1", "currentlyTaught": True},
        {"termCode": "1272", "subject": {"subjectCode": "266"}, "courseId": "2", "currentlyTaught": False},
    ]
    packages = {"1272/266/1": [{"packageEnrollmentStatus": {"availableSeats": 5}}]}
    client = EnrollClient(session=FakeSession(packages=packages))

    out_path = fetch_all_enrollment_packages(client, courses, out_dir=tmp_path)
    result = json.loads(out_path.read_text())

    assert len(result) == 1
    assert result[0]["course_id"] == "1"
    # course "2" never gets a network call at all - not just filtered after
    assert all("266/2" not in call for call in client.session.get_calls)


def test_enrollment_packages_handles_404_as_not_offered(tmp_path):
    courses = [{"termCode": "1272", "subject": {"subjectCode": "266"}, "courseId": "999", "currentlyTaught": True}]
    client = EnrollClient(session=FakeSession(packages={}))  # 999 not in packages -> 404

    out_path = fetch_all_enrollment_packages(client, courses, out_dir=tmp_path)
    result = json.loads(out_path.read_text())
    assert result == []
