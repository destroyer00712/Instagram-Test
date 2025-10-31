# GCP Deployment Guide - Instagram & WhatsApp Fact-Checking Bot

## Overview

This guide will help you deploy your Instagram & WhatsApp fact-checking bot to Google Cloud Platform with:
- ✅ Custom domain name
- ✅ SSL/TLS certificates
- ✅ Instagram webhook support
- ✅ WhatsApp webhook support
- ✅ Qdrant vector database
- ✅ Auto-scaling
- ✅ Production-ready setup

---

## Prerequisites

1. **GCP Account** with billing enabled
2. **Domain name** (you'll connect this)
3. **Google Cloud SDK** (`gcloud`) installed locally
4. **Docker** installed locally (for building images)

---

## Architecture Overview

```
┌─────────────────┐
│  Custom Domain  │
│  (example.com)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Cloud Load      │
│ Balancer        │
│ (SSL/TLS)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Cloud Run      │      │  Compute Engine │
│  (Bot App)      │──────│  (Qdrant DB)    │
│  Auto-scaling   │      │  Internal Only  │
└─────────────────┘      └─────────────────┘
```

---

## Step 1: Initial GCP Setup

### 1.1 Create GCP Project

```bash
# Login to GCP
gcloud auth login

# Create new project
gcloud projects create instagram-fact-check-bot \
  --name="Instagram Fact Check Bot" \
  --set-as-default

# Enable billing (replace BILLING_ACCOUNT_ID)
gcloud billing projects link instagram-fact-check-bot \
  --billing-account=BILLING_ACCOUNT_ID

# Set project
gcloud config set project instagram-fact-check-bot
```

### 1.2 Enable Required APIs

```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Enable Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Enable Container Registry API
gcloud services enable containerregistry.googleapis.com

# Enable Compute Engine API (for Qdrant)
gcloud services enable compute.googleapis.com

# Enable Cloud DNS API (for domain)
gcloud services enable dns.googleapis.com

# Enable Secret Manager API (for sensitive data)
gcloud services enable secretmanager.googleapis.com

# Enable Cloud Load Balancing API (for SSL)
gcloud services enable compute.googleapis.com
```

---

## Step 2: Build and Push Docker Image

### 2.1 Configure Docker for GCP

```bash
# Configure Docker to use GCP Container Registry
gcloud auth configure-docker

# Set project
export PROJECT_ID=$(gcloud config get-value project)
```

### 2.2 Build and Push Image

```bash
# Build the Docker image
docker build -t gcr.io/$PROJECT_ID/instagram-bot:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/instagram-bot:latest
```

---

## Step 3: Set Up Secrets (Environment Variables)

### 3.1 Create Secrets in Secret Manager

```bash
# Instagram Secrets
echo -n "your_instagram_access_token" | gcloud secrets create instagram-access-token --data-file=-
echo -n "your_instagram_app_secret" | gcloud secrets create instagram-app-secret --data-file=-
echo -n "your_webhook_verify_token" | gcloud secrets create instagram-verify-token --data-file=-

# Google API Secrets
echo -n "your_gemini_api_key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your_google_search_api_key" | gcloud secrets create google-search-api-key --data-file=-
echo -n "your_google_search_engine_id" | gcloud secrets create google-search-engine-id --data-file=-

# WhatsApp Secrets (optional)
echo -n "your_whatsapp_access_token" | gcloud secrets create whatsapp-access-token --data-file=-
echo -n "your_whatsapp_verify_token" | gcloud secrets create whatsapp-verify-token --data-file=-
echo -n "your_whatsapp_phone_number_id" | gcloud secrets create whatsapp-phone-number-id --data-file=-

# Qdrant Configuration
echo -n "fact_checks" | gcloud secrets create vector-cache-collection --data-file=-
```

### 3.2 Grant Cloud Run Access to Secrets

```bash
# Get service account email
export SERVICE_ACCOUNT=$(gcloud iam service-accounts list --filter="displayName:Compute Engine default service account" --format="value(email)")

# Grant access to all secrets
gcloud secrets add-iam-policy-binding instagram-access-token \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding instagram-app-secret \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding instagram-verify-token \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding google-search-api-key \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding google-search-engine-id \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

# WhatsApp secrets (if using)
gcloud secrets add-iam-policy-binding whatsapp-access-token \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding whatsapp-verify-token \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding whatsapp-phone-number-id \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 4: Deploy Qdrant Database

### Option A: Qdrant on Compute Engine (Recommended)

```bash
# Create VM instance for Qdrant
gcloud compute instances create qdrant-vm \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=20GB \
  --tags=qdrant-server

# Create firewall rule for internal access only
gcloud compute firewall-rules create allow-qdrant-internal \
  --allow tcp:6333 \
  --source-ranges 10.0.0.0/8 \
  --target-tags qdrant-server \
  --description "Allow internal Qdrant access"

# SSH into VM and install Qdrant
gcloud compute ssh qdrant-vm --zone=us-central1-a --command="
  docker run -d \
    --name qdrant \
    --restart unless-stopped \
    -p 6333:6333 \
    -v /qdrant/storage:/qdrant/storage \
    qdrant/qdrant:latest
"

# Get internal IP
export QDRANT_INTERNAL_IP=$(gcloud compute instances describe qdrant-vm \
  --zone=us-central1-a \
  --format="get(networkInterfaces[0].networkIP)")
```

### Option B: Use Qdrant Cloud (Easier)

1. Sign up at https://cloud.qdrant.io/
2. Create a cluster
3. Get your cluster URL and API key
4. Store API key in Secret Manager:
```bash
echo -n "your_qdrant_api_key" | gcloud secrets create qdrant-api-key --data-file=-
```

---

## Step 5: Deploy Application to Cloud Run

### 5.1 Create Cloud Run Service

```bash
# Deploy to Cloud Run
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
  --set-env-vars="NODE_ENV=production,PORT=8080" \
  --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest,QDRANT_URL=http://$QDRANT_INTERNAL_IP:6333"

# Get Cloud Run URL
export CLOUD_RUN_URL=$(gcloud run services describe instagram-bot \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)")
```

**Note**: If using Qdrant Cloud, update `QDRANT_URL` to your cloud cluster URL.

---

## Step 6: Set Up Custom Domain & SSL

### 6.1 Reserve a Static IP

```bash
# Reserve global IP address
gcloud compute addresses create instagram-bot-ip \
  --global

# Get the IP address
export STATIC_IP=$(gcloud compute addresses describe instagram-bot-ip \
  --global \
  --format="value(address)")
```

### 6.2 Create Load Balancer

```bash
# Create backend service
gcloud compute backend-services create instagram-bot-backend \
  --global \
  --protocol HTTP \
  --health-checks=http-health-check \
  --port-name=http

# Create health check
gcloud compute health-checks create http http-health-check \
  --port 8080 \
  --request-path /health

# Add Cloud Run as backend
gcloud compute backend-services add-backend instagram-bot-backend \
  --global \
  --network-endpoint-group=instagram-bot-neg \
  --network-endpoint-group-region=us-central1

# Create URL map
gcloud compute url-maps create instagram-bot-map \
  --default-service instagram-bot-backend

# Create HTTPS proxy
gcloud compute target-https-proxies create instagram-bot-https-proxy \
  --url-map instagram-bot-map \
  --ssl-certificates=instagram-bot-ssl-cert

# Create forwarding rule
gcloud compute forwarding-rules create instagram-bot-https-rule \
  --global \
  --target-https-proxy instagram-bot-https-proxy \
  --address instagram-bot-ip \
  --ports 443
```

### 6.3 Set Up Domain with Cloud DNS

```bash
# Create DNS zone
gcloud dns managed-zones create instagram-bot-zone \
  --dns-name="your-domain.com" \
  --description="DNS zone for Instagram bot"

# Get name servers
gcloud dns managed-zones describe instagram-bot-zone \
  --format="value(nameServers)"

# Add A record pointing to static IP
gcloud dns record-sets create your-domain.com. \
  --zone=instagram-bot-zone \
  --type=A \
  --ttl=300 \
  --rrdatas=$STATIC_IP

# Add www subdomain
gcloud dns record-sets create www.your-domain.com. \
  --zone=instagram-bot-zone \
  --type=A \
  --ttl=300 \
  --rrdatas=$STATIC_IP
```

### 6.4 Configure SSL Certificate

```bash
# Create SSL certificate (managed by Google)
gcloud compute ssl-certificates create instagram-bot-ssl-cert \
  --domains=your-domain.com,www.your-domain.com \
  --global

# Wait for certificate provisioning (can take 10-60 minutes)
gcloud compute ssl-certificates describe instagram-bot-ssl-cert \
  --global
```

**Note**: Update your domain registrar's nameservers to point to Cloud DNS nameservers (from step 6.3).

---

## Step 7: Configure Webhooks

### 7.1 Instagram Webhook Setup

1. **Get your webhook URL**: `https://your-domain.com/webhook`

2. **In Facebook Developer Console**:
   - Go to your Instagram App
   - Settings → Basic → Add Instagram Product
   - Configure Webhooks:
     - **Callback URL**: `https://your-domain.com/webhook`
     - **Verify Token**: (same as in Secret Manager)
   - Subscribe to events:
     - `messages`
     - `messaging_postbacks`

3. **Test Webhook**:
```bash
# Test webhook verification
curl -X GET "https://your-domain.com/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
```

### 7.2 WhatsApp Webhook Setup

1. **Get your webhook URL**: `https://your-domain.com/whatsapp-webhook`

2. **In Meta Business Suite**:
   - Go to WhatsApp → Configuration → Webhooks
   - **Callback URL**: `https://your-domain.com/whatsapp-webhook`
   - **Verify Token**: (same as in Secret Manager)
   - Subscribe to events:
     - `messages`
     - `message_status`

3. **Test Webhook**:
```bash
# Test webhook verification
curl -X GET "https://your-domain.com/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
```

---

## Step 8: Update Cloud Run for VPC Access (Qdrant)

If using Qdrant on Compute Engine, configure VPC connector:

```bash
# Create VPC connector
gcloud compute networks vpc-access connectors create qdrant-connector \
  --region=us-central1 \
  --subnet=default \
  --subnet-project=$PROJECT_ID \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro

# Update Cloud Run service with VPC connector
gcloud run services update instagram-bot \
  --vpc-connector=qdrant-connector \
  --region=us-central1 \
  --platform=managed
```

---

## Step 9: Monitoring & Logging

### 9.1 View Logs

```bash
# View Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=instagram-bot" \
  --limit 50 \
  --format json

# Or use Cloud Console
# https://console.cloud.google.com/logs
```

### 9.2 Set Up Alerts

```bash
# Create alert policy for errors
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Instagram Bot Errors" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s
```

---

## Step 10: Cost Optimization

### 10.1 Enable Auto-scaling

Cloud Run automatically scales, but you can optimize:

```bash
# Update Cloud Run service for cost optimization
gcloud run services update instagram-bot \
  --min-instances=0 \
  --max-instances=5 \
  --cpu-throttling \
  --region=us-central1 \
  --platform=managed
```

### 10.2 Estimated Monthly Costs

**Small Scale (< 1,000 requests/day)**:
- Cloud Run: ~$10-20/month
- Qdrant VM: ~$15/month
- Load Balancer: ~$20/month
- Domain & DNS: ~$1/month
- **Total: ~$46-56/month**

**Medium Scale (1,000-10,000 requests/day)**:
- Cloud Run: ~$30-50/month
- Qdrant VM: ~$30/month
- Load Balancer: ~$20/month
- **Total: ~$80-100/month**

---

## Troubleshooting

### Webhook Not Receiving Requests

1. **Check SSL Certificate**:
```bash
gcloud compute ssl-certificates describe instagram-bot-ssl-cert --global
```

2. **Verify Load Balancer**:
```bash
gcloud compute backend-services get-health instagram-bot-backend --global
```

3. **Check Cloud Run Logs**:
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 100
```

### Qdrant Connection Issues

1. **Test internal connectivity**:
```bash
# SSH into Cloud Run instance and test
gcloud run services logs read instagram-bot --limit 50
```

2. **Verify VPC connector**:
```bash
gcloud compute networks vpc-access connectors describe qdrant-connector \
  --region=us-central1
```

### Domain Not Resolving

1. **Check DNS records**:
```bash
gcloud dns record-sets list --zone=instagram-bot-zone
```

2. **Verify nameservers** (update at your domain registrar)

---

## Quick Reference Commands

```bash
# Deploy new version
docker build -t gcr.io/$PROJECT_ID/instagram-bot:latest .
docker push gcr.io/$PROJECT_ID/instagram-bot:latest
gcloud run deploy instagram-bot --image gcr.io/$PROJECT_ID/instagram-bot:latest --region us-central1

# View logs
gcloud run services logs read instagram-bot --region us-central1

# Check service status
gcloud run services describe instagram-bot --region us-central1

# Update environment variables
gcloud run services update instagram-bot \
  --update-env-vars KEY=VALUE \
  --region us-central1

# Scale manually
gcloud run services update instagram-bot \
  --min-instances=2 \
  --max-instances=10 \
  --region us-central1
```

---

## Next Steps

1. ✅ Deploy application to Cloud Run
2. ✅ Set up custom domain and SSL
3. ✅ Configure Instagram webhook
4. ✅ Configure WhatsApp webhook
5. ✅ Monitor logs and performance
6. ✅ Set up alerts for errors
7. ✅ Optimize costs based on usage

Your bot is now live at `https://your-domain.com`! 🚀
