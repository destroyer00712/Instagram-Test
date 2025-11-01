#!/bin/bash

# Simple rebuild and deploy script
# Uses the existing Dockerfile

set -e

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo "❌ No default project set"
    exit 1
fi

echo "🚀 Building and deploying..."
echo ""

# Build and push with Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/instagram-bot:latest --quiet

# Deploy to Cloud Run
gcloud run deploy instagram-bot \
    --image gcr.io/$PROJECT_ID/instagram-bot:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 1 \
    --concurrency 80 \
    --set-env-vars="NODE_ENV=production,PORT=8080,INSTAGRAM_ACCOUNT_ID=17841472601427095,GOOGLE_FACTCHECK_API_KEY=AIzaSyAGyixCiUxd_POqeBG2jlp92JH8Cl4UqIE" \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest" \
    --quiet

echo ""
echo "✅ Done!"

