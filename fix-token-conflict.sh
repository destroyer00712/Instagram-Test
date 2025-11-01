#!/bin/bash

# Quick fix for the INSTAGRAM_ACCESS_TOKEN type conflict
# This removes it as env var first, then sets it as secret

set -e

SERVICE_NAME="instagram-bot"
REGION="us-central1"
SECRET_NAME="instagram-access-token"

echo "🔧 Fixing INSTAGRAM_ACCESS_TOKEN type conflict..."
echo ""

# Step 1: Remove as environment variable
echo "Step 1: Removing INSTAGRAM_ACCESS_TOKEN as environment variable..."
gcloud run services update "$SERVICE_NAME" \
    --platform managed \
    --region "$REGION" \
    --remove-env-vars="INSTAGRAM_ACCESS_TOKEN" \
    --quiet

echo "✅ Removed as environment variable"
echo ""

# Step 2: Set as secret
echo "Step 2: Setting INSTAGRAM_ACCESS_TOKEN as secret..."
gcloud run services update "$SERVICE_NAME" \
    --platform managed \
    --region "$REGION" \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=${SECRET_NAME}:latest" \
    --quiet

echo "✅ Set as secret"
echo ""
echo "🎉 Fixed! The service should now use the secret version."
echo ""
echo "The secret was already updated in Step 1 of the previous script,"
echo "so your new token is already in Secret Manager and will be used."

