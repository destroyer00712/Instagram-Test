#!/bin/bash

# GCP Cloud Build Deployment Script for Instagram & WhatsApp Fact-Checking Bot
# Uses Cloud Build instead of local Docker for faster, more reliable builds

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting GCP Cloud Build Deployment${NC}"
echo -e "${BLUE}   Using Cloud Build (faster & more reliable)${NC}\n"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  No default project set.${NC}"
    echo -e "${YELLOW}Please set a project:${NC}"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✓ Using project: $PROJECT_ID${NC}\n"

# Step 1: Enable required APIs
echo -e "${YELLOW}Step 1: Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com \
    --quiet 2>/dev/null || true

echo -e "${GREEN}✓ APIs enabled${NC}\n"

# Step 2: Build and push using Cloud Build (no local Docker needed!)
echo -e "${YELLOW}Step 2: Building Docker image with Cloud Build...${NC}"
echo -e "${BLUE}   This will take 10-20 minutes...${NC}\n"

gcloud builds submit --tag gcr.io/$PROJECT_ID/instagram-bot:latest \
    --timeout=30m \
    --quiet

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Cloud Build failed. Check the build logs above.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Image built and pushed successfully${NC}\n"

# Step 3: Check if secrets exist
echo -e "${YELLOW}Step 3: Checking secrets...${NC}"
REQUIRED_SECRETS=(
    "instagram-access-token"
    "instagram-app-secret"
    "instagram-verify-token"
    "gemini-api-key"
    "google-search-api-key"
    "google-search-engine-id"
    "whatsapp-access-token"
    "whatsapp-verify-token"
    "whatsapp-phone-number-id"
    "qdrant-url"
    "qdrant-api-key"
    "vector-cache-collection"
)

MISSING_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" &>/dev/null; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing secrets: ${MISSING_SECRETS[*]}${NC}"
    echo -e "${YELLOW}Creating them now (you'll need to provide values)...${NC}\n"
    
    for secret in "${MISSING_SECRETS[@]}"; do
        echo -e "${BLUE}Enter value for $secret:${NC}"
        read -s secret_value
        echo -n "$secret_value" | gcloud secrets create "$secret" --data-file=- 2>/dev/null || \
        echo -n "$secret_value" | gcloud secrets versions add "$secret" --data-file=- 2>/dev/null || true
        echo -e "${GREEN}✓ $secret created${NC}"
    done
    echo ""
fi

echo -e "${GREEN}✓ All required secrets exist${NC}\n"

# Step 4: Grant Cloud Run access to secrets
echo -e "${YELLOW}Step 4: Granting Cloud Run access to secrets...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in "${REQUIRED_SECRETS[@]}"; do
    gcloud secrets add-iam-policy-binding "$secret" \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet 2>/dev/null || true
done

echo -e "${GREEN}✓ Service account has access to secrets${NC}\n"

# Step 5: Get Qdrant URL from secret
echo -e "${YELLOW}Step 5: Configuring Qdrant...${NC}"
QDRANT_URL=$(gcloud secrets versions access latest --secret="qdrant-url" 2>/dev/null || echo "")

if [ -z "$QDRANT_URL" ]; then
    echo -e "${YELLOW}⚠️  Qdrant URL not found. Please enter it:${NC}"
    read -p "Qdrant URL (e.g., https://xxxxx.us-central1-0.gcp.cloud.qdrant.io): " QDRANT_URL
    if [ -n "$QDRANT_URL" ]; then
        echo -n "$QDRANT_URL" | gcloud secrets create qdrant-url --data-file=- 2>/dev/null || \
        echo -n "$QDRANT_URL" | gcloud secrets versions add qdrant-url --data-file=- 2>/dev/null || true
    fi
fi

if [ -z "$QDRANT_URL" ]; then
    echo -e "${RED}❌ Qdrant URL is required${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Using Qdrant URL: $QDRANT_URL${NC}\n"

# Step 6: Deploy to Cloud Run
echo -e "${YELLOW}Step 6: Deploying to Cloud Run...${NC}"

gcloud run deploy instagram-bot \
    --image gcr.io/$PROJECT_ID/instagram-bot:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 0.25 \
    --timeout 180 \
    --max-instances 2 \
    --min-instances 0 \
    --concurrency 1 \
    --set-env-vars="NODE_ENV=production,QDRANT_URL=$QDRANT_URL" \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,QDRANT_API_KEY=qdrant-api-key:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest" \
    --quiet

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed. Check the error messages above.${NC}"
    exit 1
fi

CLOUD_RUN_URL=$(gcloud run services describe instagram-bot \
    --platform managed \
    --region us-central1 \
    --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "$CLOUD_RUN_URL" ]; then
    echo -e "${RED}❌ Could not get Cloud Run URL${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Deployment complete!${NC}\n"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Your bot is live at:${NC}"
echo -e "  ${CLOUD_RUN_URL}\n"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "${BLUE}📱 Configure Webhooks:${NC}"
echo "   Instagram: ${CLOUD_RUN_URL}/webhook"
echo "   WhatsApp: ${CLOUD_RUN_URL}/whatsapp-webhook"
echo ""
echo -e "${BLUE}🧪 Test Health:${NC}"
echo "   curl ${CLOUD_RUN_URL}/health"
echo ""
echo -e "${BLUE}📊 View Logs:${NC}"
echo "   gcloud run services logs read instagram-bot --region us-central1 --limit 50"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Success! Your bot is deployed!${NC}\n"

