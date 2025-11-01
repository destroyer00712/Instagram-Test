#!/bin/bash

# Fast Rebuild Script - Uses optimized Dockerfile
# This removes heavy dependencies (@xenova/transformers) that aren't needed since vector cache is disabled

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No default project set${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Fast Rebuild (Skipping Heavy Dependencies)${NC}"
echo -e "${BLUE}   Removing @xenova/transformers and @qdrant/js-client-rest${NC}"
echo ""

# Option 1: Use Cloud Build with fast Dockerfile
echo -e "${YELLOW}Option 1: Using Cloud Build with fast Dockerfile...${NC}"
echo -e "${BLUE}   This removes heavy packages and should be 5-10x faster${NC}"
echo ""

# Backup original Dockerfile
cp Dockerfile Dockerfile.backup

# Use fast Dockerfile
cp Dockerfile.fast Dockerfile

# Build with Cloud Build
echo "Building (this should take 3-5 minutes instead of 20+)..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/instagram-bot:latest \
    --timeout=15m \
    --quiet

# Restore original Dockerfile
mv Dockerfile.backup Dockerfile

# Deploy
echo ""
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
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
echo -e "${GREEN}✅ Fast rebuild completed!${NC}"

