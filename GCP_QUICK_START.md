# GCP Quick Start Guide (Simplified)

## Easy Deployment with Cloud Run Domain Mapping

This is a **simpler alternative** to the full Load Balancer setup. Use Cloud Run's built-in domain mapping which is easier and sufficient for most use cases.

**✅ Includes**: Application deployment, Qdrant vector database setup, custom domain, SSL certificates, and webhook configuration.

---

## Prerequisites

- GCP account with billing enabled
- Domain name (e.g., `yourdomain.com`)
- `gcloud` CLI installed
- Docker installed

---

## Quick Setup (5 Steps)

### Step 1: Initial Setup

```bash
# Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com
```

### Step 2: Create Secrets

```bash
# Create all required secrets
echo -n "your_instagram_access_token" | gcloud secrets create instagram-access-token --data-file=-
echo -n "your_instagram_app_secret" | gcloud secrets create instagram-app-secret --data-file=-
echo -n "your_webhook_verify_token" | gcloud secrets create instagram-verify-token --data-file=-
echo -n "your_gemini_api_key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your_google_search_api_key" | gcloud secrets create google-search-api-key --data-file=-
echo -n "your_google_search_engine_id" | gcloud secrets create google-search-engine-id --data-file=-

# Optional: WhatsApp secrets
echo -n "your_whatsapp_access_token" | gcloud secrets create whatsapp-access-token --data-file=-
echo -n "your_whatsapp_verify_token" | gcloud secrets create whatsapp-verify-token --data-file=-
echo -n "your_whatsapp_phone_number_id" | gcloud secrets create whatsapp-phone-number-id --data-file=-

# Qdrant config
echo -n "fact_checks" | gcloud secrets create vector-cache-collection --data-file=-
```

**For Qdrant**: Choose one option below ⬇️

---

## Step 2.5: Deploy Qdrant Vector Database

### Option A: Qdrant Cloud (Easiest - Recommended)

1. **Sign up**: Go to https://cloud.qdrant.io/
2. **Create cluster**: Choose free tier or paid plan
3. **Get credentials**: Copy your cluster URL and API key
4. **Store API key**:
```bash
echo -n "your_qdrant_api_key" | gcloud secrets create qdrant-api-key --data-file=-
```
5. **Use in deployment**: Use your Qdrant Cloud URL in Step 3

**Cost**: Free tier available, paid starts at ~$25/month

### Option B: Deploy Qdrant on GCP (Self-Hosted)

```bash
# Enable Compute Engine API
gcloud services enable compute.googleapis.com

# Create VM instance for Qdrant
gcloud compute instances create qdrant-vm \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=20GB \
  --tags=qdrant-server

# Create firewall rule (internal access only)
gcloud compute firewall-rules create allow-qdrant-internal \
  --allow tcp:6333 \
  --source-ranges 10.0.0.0/8 \
  --target-tags qdrant-server \
  --description "Allow internal Qdrant access"

# Install Docker and Qdrant on VM
gcloud compute ssh qdrant-vm --zone=us-central1-a --command="
  sudo systemctl start docker || true
  sudo docker run -d \
    --name qdrant \
    --restart unless-stopped \
    -p 6333:6333 \
    -v /qdrant/storage:/qdrant/storage \
    qdrant/qdrant:latest
"

# Get internal IP address
export QDRANT_INTERNAL_IP=$(gcloud compute instances describe qdrant-vm \
  --zone=us-central1-a \
  --format="get(networkInterfaces[0].networkIP)")

echo "Qdrant internal IP: $QDRANT_INTERNAL_IP"
echo "Use this IP in QDRANT_URL environment variable"
```

**Cost**: ~$15-30/month for VM

**Note**: You'll need to create a VPC connector for Cloud Run to access this VM (see Step 3.5 below)

---

### Step 3: Build and Deploy

```bash
# Build and push image
docker build -t gcr.io/YOUR_PROJECT_ID/instagram-bot:latest .
docker push gcr.io/YOUR_PROJECT_ID/instagram-bot:latest

# Deploy to Cloud Run
gcloud run deploy instagram-bot \
  --image gcr.io/YOUR_PROJECT_ID/instagram-bot:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars="NODE_ENV=production,PORT=8080" \
  --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest,QDRANT_URL=https://your-qdrant-cluster.qdrant.io"
```

**Note**: 
- **For Qdrant Cloud**: Replace `QDRANT_URL` with your Qdrant Cloud URL (e.g., `https://your-cluster.qdrant.io`)
- **For Self-Hosted**: Use internal IP (e.g., `http://10.x.x.x:6333`) and set up VPC connector (see Step 3.5)

### Step 3.5: Set Up VPC Connector (Required for Self-Hosted Qdrant)

If you deployed Qdrant on a VM, Cloud Run needs VPC access:

```bash
# Enable VPC Access API
gcloud services enable vpcaccess.googleapis.com

# Create VPC connector
gcloud compute networks vpc-access connectors create qdrant-connector \
  --region=us-central1 \
  --subnet=default \
  --subnet-project=YOUR_PROJECT_ID \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro

# Update Cloud Run service with VPC connector
gcloud run services update instagram-bot \
  --vpc-connector=qdrant-connector \
  --vpc-egress=all \
  --region=us-central1 \
  --platform=managed

# Update QDRANT_URL to use internal IP
gcloud run services update instagram-bot \
  --update-env-vars="QDRANT_URL=http://$QDRANT_INTERNAL_IP:6333" \
  --region=us-central1 \
  --platform=managed
```

**Note**: Replace `$QDRANT_INTERNAL_IP` with the IP you got from Step 2.5

### Step 4: Map Custom Domain

```bash
# Map your domain to Cloud Run
gcloud run domain-mappings create \
  --service instagram-bot \
  --domain yourdomain.com \
  --region us-central1 \
  --platform managed

# Get DNS records to add
gcloud run domain-mappings describe yourdomain.com \
  --region us-central1 \
  --platform managed \
  --format="export(name, status.resourceRecords)"
```

**Important**: Add the DNS records shown above to your domain registrar.

### Step 5: Configure Webhooks

#### Instagram Webhook:
- **URL**: `https://yourdomain.com/webhook`
- **Verify Token**: (same as your secret)
- **Events**: `messages`, `messaging_postbacks`

#### WhatsApp Webhook:
- **URL**: `https://yourdomain.com/whatsapp-webhook`
- **Verify Token**: (same as your secret)
- **Events**: `messages`, `message_status`

---

## Using the Deployment Script

For automated deployment:

```bash
# Make script executable
chmod +x deploy-gcp.sh

# Run deployment
./deploy-gcp.sh

# Or with domain
DOMAIN_NAME=yourdomain.com ./deploy-gcp.sh
```

---

## Using Cloud Build (CI/CD)

For automatic deployments on git push:

```bash
# Submit build
gcloud builds submit --config cloudbuild.yaml

# Or connect to GitHub
gcloud builds triggers create github \
  --name="deploy-on-push" \
  --repo-name="YOUR_REPO" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

---

## Key Differences: Cloud Run vs Load Balancer

| Feature | Cloud Run Domain Mapping | Load Balancer |
|---------|-------------------------|---------------|
| **Setup Complexity** | ⭐ Easy | ⭐⭐⭐ Complex |
| **Cost** | Lower | Higher (~$20/month) |
| **SSL** | Automatic (Google-managed) | Manual setup |
| **Features** | Basic | Advanced (CDN, etc.) |
| **Best For** | Most use cases | High traffic, advanced needs |

**Recommendation**: Start with Cloud Run domain mapping. Upgrade to Load Balancer only if you need advanced features.

---

## Quick Commands Reference

```bash
# View service
gcloud run services describe instagram-bot --region us-central1

# View logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50

# Update service
gcloud run services update instagram-bot --region us-central1

# Scale manually
gcloud run services update instagram-bot \
  --min-instances=2 \
  --max-instances=10 \
  --region us-central1

# Test endpoint
curl https://yourdomain.com/health
```

---

## Troubleshooting

### Domain Not Working
1. Check DNS records are added correctly
2. Wait 24-48 hours for DNS propagation
3. Verify domain mapping status:
   ```bash
   gcloud run domain-mappings describe yourdomain.com --region us-central1
   ```

### Webhook Not Receiving Requests
1. Check Cloud Run logs:
   ```bash
   gcloud run services logs read instagram-bot --region us-central1
   ```
2. Verify webhook URL is correct
3. Test webhook verification endpoint manually

### Out of Memory
Increase memory:
```bash
gcloud run services update instagram-bot \
  --memory 8Gi \
  --region us-central1
```

---

## Estimated Costs

**Small Scale** (< 1,000 requests/day):
- Cloud Run: ~$10-20/month
- Qdrant Cloud (Free tier): $0/month
- OR Qdrant VM: ~$15/month
- Domain: ~$12/year
- **Total: ~$10-35/month** (depending on Qdrant option)

**Medium Scale** (1,000-10,000 requests/day):
- Cloud Run: ~$30-50/month
- Qdrant Cloud: ~$25/month
- OR Qdrant VM: ~$25/month
- **Total: ~$55-75/month**

---

## Next Steps

1. ✅ Create secrets in Secret Manager
2. ✅ Deploy Qdrant (Cloud or VM)
3. ✅ Deploy application to Cloud Run
4. ✅ Map custom domain
5. ✅ Configure Instagram webhook
6. ✅ Configure WhatsApp webhook
7. ✅ Monitor logs and performance

Your bot is now live with vector caching enabled! 🚀
