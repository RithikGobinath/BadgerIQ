#!/usr/bin/env bash
# Build the API image and deploy:
#   1. badgeriq-api        - public Cloud Run service (scale-to-zero)
#   2. badgeriq-snapshot   - Cloud Run job rebuilding the snapshot weekly
#   3. badgeriq-weekly-snapshot - Cloud Scheduler trigger (Mon 10:00 UTC,
#      after CourseIQ's 06:00 refresh has finished)
#
# Requires: gcloud authenticated, GCP_PROJECT_ID set, and the service
# accounts below already created (see infra/README.md).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/courseiq/badgeriq-api:latest"
API_SA="badgeriq-api@${PROJECT_ID}.iam.gserviceaccount.com"
SNAPSHOT_SA="courseiq-refresh@${PROJECT_ID}.iam.gserviceaccount.com"

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

echo "Deploying Cloud Run job badgeriq-snapshot"
# NB: --args must use = syntax; with a space, gcloud mis-parses values
# that start with a dash (e.g. "-m,snapshot.build")
gcloud run jobs deploy badgeriq-snapshot \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --command=python \
  --args="-m,snapshot.build" \
  --service-account="${SNAPSHOT_SA}" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_SNAPSHOT=badgeriq-snapshots" \
  --memory=2Gi \
  --max-retries=1 \
  --task-timeout=1800

echo "Scheduling weekly snapshot rebuild"
gcloud scheduler jobs create http badgeriq-weekly-snapshot \
  --location "${REGION}" \
  --schedule "0 10 * * 1" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/badgeriq-snapshot:run" \
  --http-method POST \
  --oauth-service-account-email "${SNAPSHOT_SA}" \
  || gcloud scheduler jobs update http badgeriq-weekly-snapshot \
  --location "${REGION}" \
  --schedule "0 10 * * 1" \
  --uri "https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/badgeriq-snapshot:run" \
  --http-method POST \
  --oauth-service-account-email "${SNAPSHOT_SA}"

echo "Done."
