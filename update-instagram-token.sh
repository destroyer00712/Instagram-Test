#!/bin/bash

# Update Instagram Access Token and Restart Cloud Run Service
# Usage: ./update-instagram-token.sh "YOUR_NEW_ACCESS_TOKEN"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if access token is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Access token not provided${NC}"
    echo ""
    echo "Usage:"
    echo "  ./update-instagram-token.sh \"YOUR_NEW_ACCESS_TOKEN\""
    echo ""
    echo "Example:"
    echo "  ./update-instagram-token.sh \"IGAAIg8bVtJbVBZAE5kV1JucFpVVVotbkNwSC1VM2ktWEZAXbU5nMWRRMGlrX0NzOHE1WWp0SUpreEo1T1Y5WUpOc3RjX3pod3c0SWNpbkFzQjFLUW5wZAEdra1B6dzRmdzlLSml3YXNGaG1INU1NSTF5anFtZAzI5VVpEbE9YVERLRQZDZD\""
    exit 1
fi

NEW_TOKEN="$1"
SECRET_NAME="instagram-access-token"
SERVICE_NAME="instagram-bot"
REGION="us-central1"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No default project set. Please set a project:${NC}"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}🔐 Updating Instagram Access Token${NC}"
echo -e "${BLUE}   Project: $PROJECT_ID${NC}"
echo -e "${BLUE}   Service: $SERVICE_NAME${NC}"
echo -e "${BLUE}   Region: $REGION${NC}"
echo ""

# Step 1: Update secret in Secret Manager
echo -e "${YELLOW}Step 1: Updating secret in Secret Manager...${NC}"
echo -n "$NEW_TOKEN" | gcloud secrets versions add "$SECRET_NAME" \
    --data-file=- \
    --project="$PROJECT_ID"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Secret updated in Secret Manager${NC}"
else
    echo -e "${RED}❌ Failed to update secret${NC}"
    exit 1
fi

echo ""

# Step 2: Update Cloud Run service to force restart (picks up latest secret)
echo -e "${YELLOW}Step 2: Updating Cloud Run service to use new secret...${NC}"
gcloud run services update "$SERVICE_NAME" \
    --platform managed \
    --region "$REGION" \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=${SECRET_NAME}:latest" \
    --quiet

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cloud Run service updated${NC}"
else
    echo -e "${RED}❌ Failed to update Cloud Run service${NC}"
    exit 1
fi

echo ""

# Step 3: Wait a moment for service to restart
echo -e "${YELLOW}Step 3: Waiting for service to restart...${NC}"
sleep 5

echo ""

# Step 4: Get service URL
echo -e "${YELLOW}Step 4: Getting service status...${NC}"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --platform managed \
    --region "$REGION" \
    --format="value(status.url)" 2>/dev/null)

if [ ! -z "$SERVICE_URL" ]; then
    echo -e "${GREEN}✅ Service URL: $SERVICE_URL${NC}"
else
    echo -e "${YELLOW}⚠️  Could not retrieve service URL${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Instagram Access Token updated successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "   1. Test the webhook: $SERVICE_URL/webhook"
echo "   2. Check logs: gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50"
echo "   3. Follow logs: gcloud run services logs read $SERVICE_NAME --region $REGION --follow"
echo ""
echo -e "${BLUE}🔍 Verify credentials with:${NC}"
echo "   curl --location --request POST 'https://graph.instagram.com/v23.0/17841472601427095/messages' \\"
echo "     --header 'Authorization: Bearer YOUR_NEW_TOKEN' \\"
echo "     --header 'Content-Type: application/json' \\"
echo "     --data '{\"recipient\":{\"id\":\"758608673285458\"},\"message\":{\"text\":\"Test\"}}'"
echo ""

