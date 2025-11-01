#!/bin/bash

# Update Cloud Run Service Configuration
# Run this script in Google Cloud Shell

set -e

echo "🔧 Updating Cloud Run service configuration..."
echo ""

gcloud run services update instagram-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="NODE_ENV=production,QDRANT_URL=http://10.128.0.2:6333" \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest"

echo ""
echo "✅ Cloud Run service updated successfully!"
echo ""
echo "📝 Summary of changes:"
echo "  ✅ Environment variables: NODE_ENV, QDRANT_URL"
echo "  ✅ Secrets: All required secrets (removed QDRANT_API_KEY - not needed)"
echo ""
echo "✨ The webhook verification should now work correctly!"

