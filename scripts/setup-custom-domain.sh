#!/bin/bash
# Script to set up custom domain with HTTPS for Cloud Run
# Usage: ./scripts/setup-custom-domain.sh yourdomain.com

set -e

export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

if [ -z "$1" ]; then
    echo "❌ Error: Domain name required"
    echo ""
    echo "Usage: ./scripts/setup-custom-domain.sh <your-domain.com>"
    echo "Example: ./scripts/setup-custom-domain.sh bot.example.com"
    exit 1
fi

DOMAIN=$1
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SERVICE_NAME="instagram-bot"

echo "🌐 Setting up custom domain: $DOMAIN"
echo ""

# Check if domain mapping already exists
if gcloud run domain-mappings describe "$DOMAIN" --region=$REGION --platform=managed --quiet 2>/dev/null; then
    echo "⚠️  Domain mapping already exists for $DOMAIN"
    echo "Getting existing DNS records..."
else
    echo "📝 Creating domain mapping..."
    gcloud run domain-mappings create \
        --service "$SERVICE_NAME" \
        --domain "$DOMAIN" \
        --region "$REGION" \
        --platform managed
    
    echo ""
    echo "✅ Domain mapping created!"
    echo ""
    echo "⏳ Waiting for DNS records to be generated (30 seconds)..."
    sleep 30
fi

echo ""
echo "📋 DNS RECORDS TO ADD:"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Get DNS records
gcloud run domain-mappings describe "$DOMAIN" \
    --region="$REGION" \
    --platform=managed \
    --format="table(status.resourceRecords.name,status.resourceRecords.rrdata,status.resourceRecords.type)" || {
    echo "❌ Error getting DNS records. Domain mapping may still be provisioning."
    echo "Wait a minute and run: gcloud run domain-mappings describe $DOMAIN --region=$REGION --platform=managed"
    exit 1
}

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📝 NEXT STEPS:"
echo ""
echo "1. Go to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)"
echo "2. Navigate to DNS settings for $DOMAIN"
echo "3. Add the DNS records shown above"
echo "   - Usually these are A or CNAME records"
echo "   - If it asks for TTL, use 3600 (1 hour) or default"
echo ""
echo "4. Wait for DNS propagation (5-60 minutes)"
echo "5. SSL certificate will be automatically provisioned by Google"
echo "   (takes 10-60 minutes after DNS is configured)"
echo ""
echo "🔍 CHECK STATUS:"
echo "   Run: gcloud run domain-mappings describe $DOMAIN --region=$REGION --platform=managed"
echo ""
echo "✅ When ready, your webhook URLs will be:"
echo "   Instagram: https://$DOMAIN/webhook"
echo "   WhatsApp:  https://$DOMAIN/whatsapp-webhook"
echo ""

