# BadgerIQ

Course & section planning for UW–Madison students: historical grade distributions, a course-difficulty
index, and advising flags — a data-backed version of what students already piece together by hand from
Madgrades and RateMyProfessor.

Powered by the [CourseIQ](https://github.com/RithikGobinath/CourseIQ) data pipeline: **9,710 graded
courses, 19,804 instructors, 20 years of terms (Fall 2006 – Fall 2025)**, refreshed weekly.

## What it does

- **Search any course** (⌘K) — instant results with GPA at a glance
- **Course pages** — full grade distribution, plus a per-instructor comparison: enrollment-weighted GPA,
  grade-mix strip, per-term GPA trend sparkline, and matched RateMyProfessor rating. Same course,
  different graders — pick your section accordingly.
- **Difficulty rankings** — 5,488 courses ranked by enrollment-weighted GPA (min. 100 students across
  3+ terms, so one rough semester can't define a course)
- **Advising flags** — 3,351 instructor-course pairs flagged by explicit, auditable rules (not ML):
  *harsh* (GPA > 1σ below the subject average) and *inconsistent* (large term-to-term GPA swings).
  Every flag states its reason and the numbers behind it.

## Architecture

```
CourseIQ BigQuery tables
        │  (weekly, Mon 10:00 UTC - after CourseIQ's own refresh)
        ▼
badgeriq-snapshot (Cloud Run job) ──> gs://badgeriq-snapshots/snapshots/latest.json (~19 MB)
        ▼
badgeriq-api (FastAPI on Cloud Run, scale-to-zero)   ← loads snapshot into memory at startup
        ▼
web (Next.js on Vercel)                              ← no request ever touches BigQuery
```

- `api/` — FastAPI service (`app/`) + snapshot builder (`snapshot/`). The builder does all the
  analytical work (GPA weighting, ranking gates, flag rules); the API is a thin in-memory read layer.
- `web/` — Next.js 15 + Tailwind + shadcn/ui, dark theme shared with the CourseIQ results site.

## Local dev

```bash
# API (needs a snapshot - build one with GCP creds, or grab snapshots/latest.json from GCS)
cd api
pip install -e ".[dev]"
SNAPSHOT_LOCAL_PATH=snapshot/latest.json uvicorn app.main:app --port 8100

# Frontend
cd web
npm install
npm run dev   # expects the API on localhost:8100 (override with NEXT_PUBLIC_API_BASE)
```

Tests: `cd api && pytest`

## Deploy

`infra/deploy.sh` builds the image and deploys the Cloud Run service, the snapshot job, and the
Cloud Scheduler trigger. The frontend deploys on Vercel with root directory `web/` and
`NEXT_PUBLIC_API_BASE` pointed at the Cloud Run URL.

## Honest limits

Difficulty here means *how generously a course has been graded historically* — it's a GPA signal,
not a measure of workload, teaching quality, or how hard the material is. Flags are statistical
outliers, not judgments; a low-GPA instructor may simply teach the honors section.
