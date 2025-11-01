#!/bin/bash

# ⚠️ WARNING: This script uses plain text secrets in the command
# This is NOT recommended for production. Secrets should be stored in Secret Manager.
# This is provided for convenience only - use at your own risk!

# Update Cloud Run Service with actual values
# Run this script in Google Cloud Shell

set -e

echo "⚠️  WARNING: This uses plain text secrets - not recommended for production!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "🔧 Updating Cloud Run service with actual values..."
echo ""

gcloud run services update instagram-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="NODE_ENV=production,QDRANT_URL=http://10.128.0.2:6333,INSTAGRAM_ACCESS_TOKEN=IGAAIg8bVtJbVBZAE5kV1JucFpVVVotbkNwSC1VM2ktWEZAXbU5nMWRRMGlrX0NzOHE1WWp0SUpreEo1T1Y5WUpOc3RjX3pod3c0SWNpbkFzQjFLUW5wZAEdra1B6dzRmdzlLSml3YXNGaG1INU1NSTF5anFtZAzI5VVpEbE9YVERLRQZDZD,INSTAGRAM_APP_SECRET=0b88034bd3ac110fef3f9574e535c227,INSTAGRAM_VERIFY_TOKEN=TestDMBot_verify_token_123,INSTAGRAM_ACCOUNT_ID=17841472601427095,GEMINI_API_KEY=AIzaSyDSXUn0119Y2PvziToD2_PZQ0eYDBFFV-o,GOOGLE_CUSTOM_SEARCH_API_KEY=AIzaSyDlt5Xz7LP8cqocWOk-tJV_OJXIa4MgJ3w,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=d05940e9dbc6a4268,GOOGLE_FACTCHECK_API_KEY=AIzaSyAGyixCiUxd_POqeBG2jlp92JH8Cl4UqIE" \
    --set-secrets="WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest"

echo ""
echo "✅ Cloud Run service updated!"
echo ""
echo "⚠️  Remember: These secrets are now visible in Cloud Run service logs!"
echo "   For better security, migrate these to Secret Manager."

