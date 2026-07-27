"""Entrypoint for the daily BadgerIQ refresh job.

Chains enroll.wisc.edu ingestion (catalog + live seats) straight into the
snapshot build. Runs daily rather than the originally-planned weekly
catalog / 4-hourly seats split - once the real compute cost was worked
out (~40 min per full enrollment-packages pull), 4-hourly would have run
~5x over the Cloud Run free tier for a live-data project that's been $0
so far. Daily fits comfortably in the free tier and doubles as the
catalog refresh too, since daily is already more frequent than the
catalog needs. Nothing about the seats data needs to persist between
runs - each run fetches fresh and consumes it within the same container
lifetime, so there's no raw-data bucket to manage.
"""
from __future__ import annotations

import json

from ingest.enroll_client import EnrollClient, fetch_all_catalogs, fetch_all_enrollment_packages
from snapshot import build


def run() -> None:
    print("== Refreshing enroll.wisc.edu catalog + live seats ==")
    client = EnrollClient()
    catalog_path, _ = fetch_all_catalogs(client)
    courses = json.loads(catalog_path.read_text())
    fetch_all_enrollment_packages(client, courses)

    print("== Rebuilding snapshot ==")
    build.run()

    print("== Refresh complete ==")


if __name__ == "__main__":
    run()
