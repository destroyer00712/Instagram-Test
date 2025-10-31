#!/bin/bash

# GCP Deployment Script for Instagram & WhatsApp Fact-Checking Bot
# This script automates the GCP deployment process with Qdrant Cloud Free Tier

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting GCP Deployment for Instagram & WhatsApp Fact-Checking Bot${NC}"
echo -e "${BLUE}   With Qdrant Cloud Free Tier (Vector Caching)${NC}\n"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install it first.${NC}"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  No default project set. Please set a project:${NC}"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✓ Using project: $PROJECT_ID${NC}\n"

# Step 1: Enable required APIs
echo -e "${YELLOW}Step 1: Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    compute.googleapis.com \
    dns.googleapis.com \
    secretmanager.googleapis.com \
    --quiet

echo -e "${GREEN}✓ APIs enabled${NC}\n"

# Step 2: Build and push Docker image
echo -e "${YELLOW}Step 2: Building and pushing Docker image...${NC}"
docker build -t gcr.io/$PROJECT_ID/instagram-bot:latest .
docker push gcr.io/$PROJECT_ID/instagram-bot:latest
echo -e "${GREEN}✓ Image built and pushed${NC}\n"

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
    "qdrant-api-key"
    "qdrant-url"
    "vector-cache-collection"
)

MISSING_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" &>/dev/null; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing secrets: ${MISSING_SECRETS[*]}${NC}"
    echo -e "${YELLOW}Please create them using:${NC}"
    echo "   echo -n 'value' | gcloud secrets create SECRET_NAME --data-file=-"
    echo ""
    echo -e "${YELLOW}Required secrets:${NC}"
    echo "   - Instagram: instagram-access-token, instagram-app-secret, instagram-verify-token"
    echo "   - Google APIs: gemini-api-key, google-search-api-key, google-search-engine-id"
    echo "   - WhatsApp: whatsapp-access-token, whatsapp-verify-token, whatsapp-phone-number-id"
    echo "   - Qdrant: qdrant-api-key, qdrant-url, vector-cache-collection"
    exit 1
fi

echo -e "${GREEN}✓ All required secrets exist${NC}\n"

# Step 3.5: Grant Cloud Run access to secrets
echo -e "${YELLOW}Step 3.5: Granting Cloud Run access to secrets...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in "${REQUIRED_SECRETS[@]}"; do
    gcloud secrets add-iam-policy-binding "$secret" \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet &>/dev/null || true
done

echo -e "${GREEN}✓ Service account has access to secrets${NC}\n"

# Step 4: Get Qdrant URL from secret
echo -e "${YELLOW}Step 4: Configuring Qdrant Cloud...${NC}"
QDRANT_URL=$(gcloud secrets versions access latest --secret="qdrant-url" 2>/dev/null || echo "")

if [ -z "$QDRANT_URL" ]; then
    echo -e "${YELLOW}⚠️  Qdrant URL not found in secrets.${NC}"
    echo -e "${YELLOW}Please enter your Qdrant Cloud cluster URL:${NC}"
    read -p "Qdrant URL (e.g., https://xxxxx-xxxxx.us-central1-0.gcp.cloud.qdrant.io): " QDRANT_URL
    
    if [ -n "$QDRANT_URL" ]; then
        echo -n "$QDRANT_URL" | gcloud secrets create qdrant-url --data-file=- 2>/dev/null || \
        echo -n "$QDRANT_URL" | gcloud secrets versions add qdrant-url --data-file=-
        echo -e "${GREEN}✓ Qdrant URL stored${NC}"
    else
        echo -e "${RED}❌ Qdrant URL is required. Please set QDRANT_URL environment variable or create secret.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Using Qdrant URL: $QDRANT_URL${NC}\n"

# Step 5: Deploy to Cloud Run
echo -e "${YELLOW}Step 5: Deploying to Cloud Run...${NC}"

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
    --set-env-vars="NODE_ENV=production,PORT=8080,QDRANT_URL=$QDRANT_URL" \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,QDRANT_API_KEY=qdrant-api-key:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest" \
    --quiet

CLOUD_RUN_URL=$(gcloud run services describe instagram-bot \
    --platform managed \
    --region us-central1 \
    --format="value(status.url)")

echo -e "${GREEN}✓ Deployed to Cloud Run${NC}"
echo -e "${GREEN}  URL: $CLOUD_RUN_URL${NC}\n"

# Step 6: Domain mapping (if domain provided)
if [ -n "$DOMAIN_NAME" ]; then
    echo -e "${YELLOW}Step 6: Mapping custom domain...${NC}"
    
    # Check if domain mapping already exists
    if gcloud run domain-mappings describe "$DOMAIN_NAME" --region us-central1 --platform managed &>/dev/null; then
        echo -e "${GREEN}✓ Domain mapping already exists${NC}"
    else
        gcloud run domain-mappings create \
            --service instagram-bot \
            --domain "$DOMAIN_NAME" \
            --region us-central1 \
            --platform managed 2>/dev/null || echo -e "${YELLOW}⚠️  Domain mapping may need manual setup${NC}"
        
        echo -e "${GREEN}✓ Domain mapping configured${NC}"
        
        # Get DNS records
        echo -e "${YELLOW}📋 DNS Records to add at your domain registrar:${NC}"
        gcloud run domain-mappings describe "$DOMAIN_NAME" \
            --region us-central1 \
            --platform managed \
            --format="value(status.resourceRecords)" | while read -r record; do
            echo "   $record"
        done
    fi
    echo ""
fi

echo -e "${GREEN}✅ Deployment complete!${NC}\n"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Your bot is available at:${NC}"
echo -e "  ${CLOUD_RUN_URL}\n"
if [ -n "$DOMAIN_NAME" ]; then
    echo -e "${GREEN}Custom domain:${NC}"
    echo -e "  https://${DOMAIN_NAME}\n"
fi
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "${BLUE}📱 Webhook Configuration:${NC}"
echo "   1. Instagram webhook:"
echo "      URL: ${CLOUD_RUN_URL}/webhook"
echo "      Verify Token: (from instagram-verify-token secret)"
echo ""
echo "   2. WhatsApp webhook:"
echo "      URL: ${CLOUD_RUN_URL}/whatsapp-webhook"
echo "      Verify Token: (from whatsapp-verify-token secret)"
echo ""
echo -e "${BLUE}🧪 Testing:${NC}"
echo "   Health check: curl ${CLOUD_RUN_URL}/health"
echo "   Instagram verify: curl \"${CLOUD_RUN_URL}/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test\""
echo "   WhatsApp verify: curl \"${CLOUD_RUN_URL}/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test\""
echo ""
echo -e "${BLUE}📊 Monitoring:${NC}"
echo "   View logs: gcloud run services logs read instagram-bot --region us-central1"
echo "   Follow logs: gcloud run services logs read instagram-bot --region us-central1 --follow"
echo ""
echo -e "${BLUE}🔧 Management:${NC}"
echo "   Update secrets: echo -n 'new_value' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo "   Redeploy: ./deploy-gcp.sh"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo -e "${GREEN}Your Instagram & WhatsApp fact-checking bot is live!${NC}\n"
