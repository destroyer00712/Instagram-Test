#!/bin/bash

# Grant Cloud Run service account access to qdrant-api-key secret

set -e

PROJECT_ID="instagram-fact-check-bot"
PROJECT_NUMBER="76074683301"
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
SECRET_NAME="qdrant-api-key"

echo "🔐 Granting service account access to secret..."

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID"

echo ""
echo "✅ Permission granted successfully!"
echo ""
echo "Now you can retry the Cloud Run update command."

