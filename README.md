# BadgerIQ

Course & section planning for UW–Madison students: historical grade distributions, a course-difficulty
index, and advising flags — a data-backed version of what students already piece together by hand from
Madgrades and RateMyProfessor.

Powered by the [CourseIQ](https://github.com/RithikGobinath/CourseIQ) data pipeline (11,500+ courses,
383k section-instructor grade records, refreshed weekly).

## Status

Early scaffolding — snapshot builder, API, and frontend are being built out incrementally.

## Architecture

```
CourseIQ BigQuery tables ──> snapshot builder (weekly) ──> GCS snapshot ──> FastAPI (Cloud Run) ──> Next.js (Vercel)
```

- `api/` — FastAPI service + the snapshot builder that precomputes course summaries, difficulty scores,
  and advising flags from BigQuery (no live BigQuery queries per page load).
- `web/` — Next.js frontend.
