# BadgerIQ

Course & section planning for UW–Madison students: historical grade distributions, live seats and
schedules, prerequisites, gen-ed tags, a course-difficulty index, and advising flags — a data-backed
version of what students already piece together by hand from Madgrades, RateMyProfessor, and the
course guide.

Powered by two real, live data sources: the [CourseIQ](https://github.com/RithikGobinath/CourseIQ)
pipeline (**9,710 graded courses, 19,804 instructors, 20 years of terms**, Fall 2006 – Fall 2025) and
UW's own public Course Search & Enroll API (current-term catalog, prerequisites, gen-ed tags, and live
seats/waitlist status). Both refresh daily.

## What it does

- **Search any course** (⌘K) — instant results with GPA at a glance
- **Course pages** — full historical grade distribution, a per-instructor comparison (enrollment-weighted
  GPA, grade-mix strip, per-term GPA trend, matched RateMyProfessor rating), and — when currently offered —
  the real description, prerequisites, gen-ed/breadth tags, and a live sections table with actual meeting
  times, instructors, and open-seat/waitlist status (with a "checked Xm ago" freshness timestamp, since
  seats are refreshed daily, not real-time).
- **My Semester** — a schedule builder: add sections from any course page, see them laid out on a real
  weekly calendar, and get automatic time-conflict detection (computed on the unambiguous day-list the
  API provides, not the ambiguous "MWF"-style string). No login — stored in the browser, with a "share
  plan" link that re-fetches live data on import rather than trusting stale encoded times.
- **Difficulty rankings** — 5,488 courses ranked by enrollment-weighted GPA (min. 100 students across
  3+ terms, so one rough semester can't define a course)
- **Advising flags** — 3,351 instructor-course pairs flagged by explicit, auditable rules (not ML):
  *harsh* (GPA > 1σ below the subject average) and *inconsistent* (large term-to-term GPA swings).
  Every flag states its reason and the numbers behind it.

## Architecture

```
CourseIQ BigQuery tables ──┐
                            ├─▶ badgeriq-refresh (Cloud Run job, daily 11:00 UTC)
enroll.wisc.edu (live) ─────┘        │  catalog + live seats, joined onto Madgrades courses
                                      ▼
                    gs://badgeriq-snapshots/snapshots/latest.json (~26 MB)
                                      ▼
              badgeriq-api (FastAPI on Cloud Run, scale-to-zero)  ← loads snapshot into memory at startup
                                      ▼
                    web (Next.js on Vercel)   ← no request ever touches BigQuery or enroll.wisc.edu
```

- `api/ingest/` — `enroll_client.py`: UW's public, unauthenticated Course Search & Enroll API
  (catalog + live enrollment packages). No NetID/session needed - verified live.
- `api/snapshot/` — `build.py` (BigQuery → course/instructor/flag data) and `enroll_join.py` (joins
  enroll.wisc.edu catalog/seats onto the same courses by subject+catalog-number). All the analytical
  work happens here; the API is a thin in-memory read layer.
- `api/refresh.py` — the daily job entrypoint: ingest → join → snapshot → upload.
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

`infra/deploy.sh` builds the image and deploys the Cloud Run API service, the `badgeriq-refresh` job
(4Gi/2CPU/90min timeout - the live enrollment-packages pull is ~7,600 requests), and its daily
Cloud Scheduler trigger. The frontend deploys on Vercel with root directory `web/` and
`NEXT_PUBLIC_API_BASE` pointed at the Cloud Run URL.

**Why daily, not real-time**: the original plan split this into a weekly catalog refresh and an
every-4-hours seats refresh. Once the real compute cost worked out (~40 min per full seats pull,
6x/day ≈ 5x the Cloud Run free tier), daily won out - it fits the free tier, still doubles as the
catalog refresh, and the UI is honest about staleness via the "seats checked Xh ago" timestamp rather
than implying a freshness the pipeline doesn't provide.

## Honest limits

Difficulty here means *how generously a course has been graded historically* — it's a GPA signal,
not a measure of workload, teaching quality, or how hard the material is. Flags are statistical
outliers, not judgments; a low-GPA instructor may simply teach the honors section. Live seat counts
can be up to ~24h stale (see the freshness timestamp on every course page) - always confirm on
[enroll.wisc.edu](https://enroll.wisc.edu) before actually registering.
