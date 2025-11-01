#!/bin/bash

# Update secrets in Secret Manager with new values
# This is the SECURE way to update your secrets

set -e

echo "🔐 Updating secrets in Secret Manager..."
echo ""

# Update Instagram secrets
echo -n "IGAAIg8bVtJbVBZAE5kV1JucFpVVVotbkNwSC1VM2ktWEZAXbU5nMWRRMGlrX0NzOHE1WWp0SUpreEo1T1Y5WUpOc3RjX3pod3c0SWNpbkFzQjFLUW5wZAEdra1B6dzRmdzlLSml3YXNGaG1INU1NSTF5anFtZAzI5VVpEbE9YVERLRQZDZD" | gcloud secrets versions add instagram-access-token --data-file=-
echo "✅ Updated instagram-access-token"

echo -n "0b88034bd3ac110fef3f9574e535c227" | gcloud secrets versions add instagram-app-secret --data-file=-
echo "✅ Updated instagram-app-secret"

echo -n "TestDMBot_verify_token_123" | gcloud secrets versions add instagram-verify-token --data-file=-
echo "✅ Updated instagram-verify-token"

# Update Google API secrets
echo -n "AIzaSyDSXUn0119Y2PvziToD2_PZQ0eYDBFFV-o" | gcloud secrets versions add gemini-api-key --data-file=-
echo "✅ Updated gemini-api-key"

echo -n "AIzaSyDlt5Xz7LP8cqocWOk-tJV_OJXIa4MgJ3w" | gcloud secrets versions add google-search-api-key --data-file=-
echo "✅ Updated google-search-api-key"

echo -n "d05940e9dbc6a4268" | gcloud secrets versions add google-search-engine-id --data-file=-
echo "✅ Updated google-search-engine-id"

echo ""
echo "✅ All secrets updated in Secret Manager!"
echo ""
echo "Now run the Cloud Run update command using secret references (secure method):"
echo ""
echo "gcloud run services update instagram-bot \\"
echo "    --platform managed \\"
echo "    --region us-central1 \\"
echo "    --set-env-vars=\"NODE_ENV=production,QDRANT_URL=http://10.128.0.2:6333,INSTAGRAM_ACCOUNT_ID=17841472601427095,GOOGLE_FACTCHECK_API_KEY=AIzaSyAGyixCiUxd_POqeBG2jlp92JH8Cl4UqIE\" \\"
echo "    --set-secrets=\"INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest\""

