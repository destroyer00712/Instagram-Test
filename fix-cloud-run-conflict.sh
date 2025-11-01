#!/bin/bash

# Fix Cloud Run Service - Remove secret references first, then add as env vars
# This handles the conflict where secrets are already set

set -e

echo "🔧 Fixing Cloud Run service - removing secret references first..."
echo ""

# Step 1: Remove secret references that we want to convert to env vars
echo "Step 1: Removing secret references..."
gcloud run services update instagram-bot \
    --platform managed \
    --region us-central1 \
    --remove-secrets="INSTAGRAM_ACCESS_TOKEN,INSTAGRAM_APP_SECRET,INSTAGRAM_VERIFY_TOKEN,GEMINI_API_KEY,GOOGLE_CUSTOM_SEARCH_API_KEY,GOOGLE_CUSTOM_SEARCH_ENGINE_ID" \
    --quiet

echo "✅ Secret references removed"
echo ""

# Step 2: Add them as environment variables
echo "Step 2: Adding as environment variables..."
gcloud run services update instagram-bot \
    --platform managed \
    --region us-central1 \
    --update-env-vars="INSTAGRAM_ACCESS_TOKEN=IGAAIg8bVtJbVBZAE5kV1JucFpVVVotbkNwSC1VM2ktWEZAXbU5nMWRRMGlrX0NzOHE1WWp0SUpreEo1T1Y5WUpOc3RjX3pod3c0SWNpbkFzQjFLUW5wZAEdra1B6dzRmdzlLSml3YXNGaG1INU1NSTF5anFtZAzI5VVpEbE9YVERLRQZDZD,INSTAGRAM_APP_SECRET=0b88034bd3ac110fef3f9574e535c227,INSTAGRAM_VERIFY_TOKEN=TestDMBot_verify_token_123,INSTAGRAM_ACCOUNT_ID=17841472601427095,GEMINI_API_KEY=AIzaSyDSXUn0119Y2PvziToD2_PZQ0eYDBFFV-o,GOOGLE_CUSTOM_SEARCH_API_KEY=AIzaSyDlt5Xz7LP8cqocWOk-tJV_OJXIa4MgJ3w,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=d05940e9dbc6a4268,GOOGLE_FACTCHECK_API_KEY=AIzaSyAGyixCiUxd_POqeBG2jlp92JH8Cl4UqIE,NODE_ENV=production,QDRANT_URL=http://10.128.0.2:6333" \
    --quiet

echo ""
echo "✅ Cloud Run service updated successfully!"
echo ""
echo "⚠️  Note: Secrets are now stored as plain text environment variables."
echo "   This works but is less secure than using Secret Manager."

