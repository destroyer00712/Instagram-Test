#!/bin/bash

# Quick Rebuild and Redeploy Script using Cloud Build (No Local Docker Required!)
# Perfect for Cloud Shell - builds in the cloud

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Rebuilding and Redeploying Instagram Bot (Cloud Build)${NC}"
echo -e "${BLUE}   Using Cloud Build - no local Docker required!${NC}"
echo ""

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No default project set. Please set a project:${NC}"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${BLUE}📦 Project: $PROJECT_ID${NC}"
echo -e "${BLUE}📍 Region: us-central1${NC}"
echo -e "${BLUE}🖼️  Service: instagram-bot${NC}"
echo ""

# Step 1: Build and push using Cloud Build
echo -e "${YELLOW}Step 1: Building Docker image with Cloud Build...${NC}"
echo -e "${BLUE}   This will take 5-10 minutes...${NC}"

gcloud builds submit --tag gcr.io/$PROJECT_ID/instagram-bot:latest \
    --timeout=30m \
    --quiet

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cloud Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Image built and pushed successfully${NC}"
echo ""

# Step 2: Deploy/Update Cloud Run service
echo -e "${YELLOW}Step 2: Deploying to Cloud Run...${NC}"

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

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo ""

# Step 3: Get service URL
echo -e "${YELLOW}Step 3: Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe instagram-bot \
    --platform managed \
    --region us-central1 \
    --format="value(status.url)" 2>/dev/null)

if [ ! -z "$SERVICE_URL" ]; then
    echo -e "${GREEN}✅ Service URL: $SERVICE_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Could not retrieve service URL${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Rebuild and redeploy completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "   1. Test webhook: $SERVICE_URL/webhook"
echo "   2. Check logs: gcloud run services logs read instagram-bot --region us-central1 --limit 50"
echo "   3. Follow logs: gcloud run services logs read instagram-bot --region us-central1 --follow"
echo ""

