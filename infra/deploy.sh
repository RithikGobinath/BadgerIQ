#!/usr/bin/env bash
# Build the API image and deploy:
#   1. badgeriq-api      - public Cloud Run service (scale-to-zero)
#   2. badgeriq-refresh  - Cloud Run job: enroll.wisc.edu ingestion (catalog
#                          + live seats) + BigQuery + snapshot rebuild
#   3. badgeriq-daily-refresh - Cloud Scheduler trigger (daily, 11:00 UTC)
#
# Daily rather than the originally-planned weekly-catalog/4-hourly-seats
# split: the full enrollment-packages pull is ~40min of runtime, and
# 4-hourly would run ~5x over the Cloud Run free tier. Daily fits inside
# it and is already more frequent than the catalog needs, so one combined
# job keeps this simple.
#
# Requires: gcloud authenticated, GCP_PROJECT_ID set, and the service
# accounts below already created (see infra/README.md).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/courseiq/badgeriq-api:latest"
API_SA="badgeriq-api@${PROJECT_ID}.iam.gserviceaccount.com"
REFRESH_SA="courseiq-refresh@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Building ${IMAGE}"
gcloud builds submit --tag "${IMAGE}" api/

echo "Deploying Cloud Run service badgeriq-api"
gcloud run deploy badgeriq-api \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --service-account "${API_SA}" \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_SNAPSHOT=badgeriq-snapshots" \
  --memory 512Mi \
  --allow-unauthenticated

echo "Deploying Cloud Run job badgeriq-refresh"
# NB: --args must use = syntax; with a space, gcloud mis-parses values
# that start with a dash.
gcloud run jobs deploy badgeriq-refresh \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --command=python \
  --args="refresh.py" \
  --service-account="${REFRESH_SA}" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_SNAPSHOT=badgeriq-snapshots,BQ_DATASET=courseiq" \
  --memory=4Gi \
  --cpu=2 \
  --max-retries=1 \
  --task-timeout=5400

echo "Scheduling daily refresh"
gcloud scheduler jobs create http badgeriq-daily-refresh \
  --location "${REGION}" \
  --schedule "0 11 * * *" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/badgeriq-refresh:run" \
  --http-method POST \
  --oauth-service-account-email "${REFRESH_SA}" \
  || gcloud scheduler jobs update http badgeriq-daily-refresh \
  --location "${REGION}" \
  --schedule "0 11 * * *" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/badgeriq-refresh:run" \
  --http-method POST \
  --oauth-service-account-email "${REFRESH_SA}"

echo "Done."
