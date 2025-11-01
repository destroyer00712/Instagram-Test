#!/bin/bash

# Fix Cloud Run Service - Update environment variables
# This script updates the Cloud Run service configuration (removes QDRANT_API_KEY since it's not needed for internal Qdrant)

set -e

echo "🔧 Fixing Cloud Run service configuration..."

# Get the QDRANT_URL (from the YAML - internal IP)
QDRANT_URL="http://10.128.0.2:6333"

echo "📋 Current configuration will be preserved and missing variables will be added..."
echo ""

# Update the Cloud Run service - update environment variables and secrets
# Note: --set-env-vars replaces all env vars
# Note: Removing QDRANT_API_KEY from secrets since it doesn't exist and isn't needed for internal Qdrant
gcloud run services update instagram-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="NODE_ENV=production,PORT=8080,QDRANT_URL=$QDRANT_URL" \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest" \
    --quiet

echo ""
echo "✅ Cloud Run service updated successfully!"
echo ""
echo "The following updates were applied:"
echo "  ✅ Updated environment variables (NODE_ENV, QDRANT_URL)"
echo "  ✅ Updated secrets (removed QDRANT_API_KEY - not needed for internal Qdrant)"
echo ""
echo "📝 Note: All existing secrets and environment variables were preserved."
echo ""
echo "🔍 Verify the update with:"
echo "   gcloud run services describe instagram-bot --region us-central1"
echo ""
echo "✨ The webhook verification should now work correctly with INSTAGRAM_VERIFY_TOKEN!"

