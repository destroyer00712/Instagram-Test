# GCP Server Setup Guide - Vector Database Caching System

This guide provides step-by-step instructions for setting up your GCP server with the vector database caching system for your Instagram & WhatsApp fact-checking bot.

## Overview

Your application uses **Qdrant** as a vector database to cache fact-check results, reducing redundant API calls and improving response times. This guide covers:

- ✅ Qdrant vector database deployment (Cloud or Self-Hosted)
- ✅ Cloud Run application deployment
- ✅ Environment variable configuration
- ✅ VPC connector setup (for self-hosted Qdrant)
- ✅ Secret management
- ✅ Custom domain and SSL
- ✅ Webhook configuration

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GCP Cloud Run                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Instagram & WhatsApp Fact-Checking Bot          │   │
│  │  - Express Server                                │   │
│  │  - Vector Cache Module (vectorCache.js)          │   │
│  │  - Fact Checker Module                           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ (VPC Connector if self-hosted)
                   │
┌──────────────────▼──────────────────────────────────────┐
│              Qdrant Vector Database                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Collection: fact_checks                         │   │
│  │  - Stores embeddings of fact-checked claims      │   │
│  │  - Similarity threshold: 0.85                    │   │
│  │  - Freshness threshold: 30 minutes               │   │
│  │  - Expiration: 1 hour                            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- ✅ GCP account with billing enabled
- ✅ `gcloud` CLI installed and configured
- ✅ Docker installed locally
- ✅ Domain name (optional, for custom domain)

---

## Step 1: Initial GCP Setup

### 1.1 Create GCP Project (if not exists)

```bash
# Login to GCP
gcloud auth login

# Create new project (or use existing)
gcloud projects create instagram-fact-check-bot \
  --name="Instagram Fact Check Bot" \
  --set-as-default

# Set project
gcloud config set project instagram-fact-check-bot

# Enable billing (replace BILLING_ACCOUNT_ID)
gcloud billing projects link instagram-fact-check-bot \
  --billing-account=BILLING_ACCOUNT_ID
```

### 1.2 Enable Required APIs

```bash
# Core APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# For self-hosted Qdrant (if using Option B)
gcloud services enable compute.googleapis.com
gcloud services enable vpcaccess.googleapis.com

# For custom domain (optional)
gcloud services enable dns.googleapis.com
```

---

## Step 2: Choose Qdrant Deployment Option

You have **two options** for Qdrant:

### Option A: Qdrant Cloud (Recommended - Easiest)

**Best for**: Most production deployments, easiest setup

**Setup Steps**:

1. **Sign up**: Go to https://cloud.qdrant.io/
2. **Create cluster**: 
   - Choose free tier (1GB RAM, 1GB disk) or paid plan
   - Select region closest to your GCP region (us-central1 recommended)
3. **Get credentials**:
   - Copy your cluster URL (e.g., `https://xxxxx-xxxxx.us-central1-0.gcp.cloud.qdrant.io`)
   - Copy your API key (if not on free tier)
4. **Store in GCP Secret Manager**:
   ```bash
   # Store Qdrant URL
   echo -n "https://1077a541-0a04-4725-b360-65724470abb6.europe-west3-0.gcp.cloud.qdrant.io" | gcloud secrets create qdrant-url --data-file=-
   
   # Store API key (if using paid tier)
   echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.nRNPXP7g2YiT6ASDTMpHu1bENa2FzaQmjJUMt1IlAbI" | gcloud secrets create qdrant-api-key --data-file=-
   
   # Store collection name
   echo -n "fact_checks" | gcloud secrets create vector-cache-collection --data-file=-
   ```

**Pros**:
- ✅ Managed service (no infrastructure management)
- ✅ Automatic backups
- ✅ High availability
- ✅ Free tier available
- ✅ Easy to scale

**Cons**:
- ❌ Monthly cost for paid plans (~$25+/month)
- ❌ Internet dependency

**Cost**: Free tier available, paid starts at ~$25/month

---

### Option B: Self-Hosted Qdrant on GCP Compute Engine

**Best for**: Full control, cost optimization, high-volume usage

**Setup Steps**:

1. **Create VM Instance**:
   ```bash
   # Create VM instance for Qdrant
   gcloud compute instances create qdrant-vm \
     --zone=us-central1-a \
     --machine-type=e2-medium \
     --image-family=cos-stable \
     --image-project=cos-cloud \
     --boot-disk-size=20GB \
     --boot-disk-type=pd-ssd \
     --tags=qdrant-server
   ```

2. **Install Docker and Qdrant**:
   ```bash
   # SSH into VM
   gcloud compute ssh qdrant-vm --zone=us-central1-a
   
   # Install Docker (on COS)
   sudo systemctl start docker || true
   
   # Run Qdrant container
   sudo docker run -d \
     --name qdrant \
     --restart unless-stopped \
     -p 6333:6333 \
     -v /qdrant/storage:/qdrant/storage \
     qdrant/qdrant:latest
   
   # Exit SSH
   exit
   ```

3. **Create Firewall Rule (Internal Only)**:
   ```bash
   # Only allow internal access (from Cloud Run)
   gcloud compute firewall-rules create allow-qdrant-internal \
     --allow tcp:6333 \
     --source-ranges 10.0.0.0/8 \
     --target-tags qdrant-server \
     --description "Allow internal Qdrant access from Cloud Run"
   ```

4. **Get Internal IP**:
   ```bash
   export QDRANT_INTERNAL_IP=$(gcloud compute instances describe qdrant-vm \
     --zone=us-central1-a \
     --format="get(networkInterfaces[0].networkIP)")
   
   echo "Qdrant Internal IP: $QDRANT_INTERNAL_IP"
   ```

5. **Store Configuration**:
   ```bash
   # Store internal IP (will be used with VPC connector)
   echo -n "http://$QDRANT_INTERNAL_IP:6333" | gcloud secrets create qdrant-url --data-file=-
   
   # Collection name (no API key needed for self-hosted)
   echo -n "fact_checks" | gcloud secrets create vector-cache-collection --data-file=-
   ```

**Pros**:
- ✅ Full control over data
- ✅ Lower cost (~$15-25/month)
- ✅ No external dependency
- ✅ Good performance

**Cons**:
- ❌ Requires server management
- ❌ Need to handle backups
- ❌ Need to monitor uptime
- ❌ Requires VPC connector setup

**Cost**: ~$15-30/month for VM

---

## Step 3: Create Application Secrets

Store all your application secrets in GCP Secret Manager:

```bash
# Instagram Secrets
echo -n "IGAAIg8bVtJbVBZAE5kV1JucFpVVVotbkNwSC1VM2ktWEZAXbU5nMWRRMGlrX0NzOHE1WWp0SUpreEo1T1Y5WUpOc3RjX3pod3c0SWNpbkFzQjFLUW5wZAEdra1B6dzRmdzlLSml3YXNGaG1INU1NSTF5anFtZAzI5VVpEbE9YVERLRQZDZD" | gcloud secrets create instagram-access-token --data-file=-
echo -n "0b88034bd3ac110fef3f9574e535c227" | gcloud secrets create instagram-app-secret --data-file=-
echo -n "TestDMBot_verify_token_123" | gcloud secrets create instagram-verify-token --data-file=-

# Google API Secrets
echo -n "AIzaSyDSXUn0119Y2PvziToD2_PZQ0eYDBFFV-o" | gcloud secrets create gemini-api-key --data-file=-
echo -n "AIzaSyDlt5Xz7LP8cqocWOk-tJV_OJXIa4MgJ3w" | gcloud secrets create google-search-api-key --data-file=-
echo -n "d05940e9dbc6a4268" | gcloud secrets create google-search-engine-id --data-file=-

# WhatsApp Secrets (required)
echo -n "EAAXjuHDqNZAcBO7fVpZB7Nt8sUZCPHzgscxQIRn1JpEPKHfJBmZAa5RAPvZAQKtIPSJEHyAiTHulu5HvgQcZC4HX3cNedZC5mtTt0ROLJS41m72vZCM1mNYDKRLXkmvsFpryHKcwW3YpBl0SZCHPiySkpPIduZBjHijRL1uogllZBpOqRZARLbq1WVPTynICoCuIZBBv1twZDZD" | gcloud secrets create whatsapp-access-token --data-file=-
echo -n "de0d2928-d41d-4170-ad82-fe220b6ac8fc" | gcloud secrets create whatsapp-verify-token --data-file=-
echo -n "355555900972609" | gcloud secrets create whatsapp-phone-number-id --data-file=-

# Qdrant Secrets (already created in Step 2)
# - qdrant-url
# - qdrant-api-key (if using Qdrant Cloud)
# - vector-cache-collection
```

### Grant Cloud Run Access to Secrets

```bash
# Get service account
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to all secrets
SECRETS=(
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

for secret in "${SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet || true
done
```

---

## Step 4: Build and Push Docker Image

### 4.1 Clone the Repository (If Not Already Done)

First, you need to clone your repository locally to build the Docker image:

```bash
# Clone your repository (replace with your actual repository URL)
git clone https://github.com/destroyer00712/Instagram-Test

# Navigate to the project directory
cd Instagram-Test

# Make sure you have the latest code
git pull origin main
```

**Note**: If you already have the repository cloned locally, just navigate to that directory and ensure it's up to date.

### 4.2 Build and Push Docker Image

```bash
# Configure Docker authentication
gcloud auth configure-docker

# Set project ID
export PROJECT_ID=$(gcloud config get-value project)

# Make sure you're in the project directory (should contain Dockerfile)
pwd  # Should show your project directory

# Build Docker image
docker build -t gcr.io/$PROJECT_ID/instagram-bot:latest .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/instagram-bot:latest
```

**Note**: The `docker build` command needs to be run from the directory containing your `Dockerfile` (which should be the root of your project).

### 4.3 Alternative: Use Cloud Build (If Docker Build Fails)

If Docker build fails or takes too long, you can use Cloud Build instead:

```bash
# Set project ID
export PROJECT_ID=$(gcloud config get-value project)

# Submit build to Cloud Build (builds in the cloud, no local Docker needed)
gcloud builds submit --tag gcr.io/$PROJECT_ID/instagram-bot:latest

# Or if you're already in the project directory with a cloudbuild.yaml
gcloud builds submit --config cloudbuild.yaml
```

This method builds in Google Cloud's infrastructure, which is often faster and doesn't require Docker to be installed locally.

---

## Step 5: Deploy Application to Cloud Run

**⚠️ Important**: Make sure you have completed Step 4 (Build and Push Docker Image) before proceeding. The Docker image must exist in Google Container Registry before you can deploy to Cloud Run.

### 5.1 Get Qdrant URL

```bash
# Option A: Qdrant Cloud
export QDRANT_URL=$(gcloud secrets versions access latest --secret="qdrant-url")

# Option B: Self-Hosted (will use internal IP)
export QDRANT_URL=$(gcloud secrets versions access latest --secret="qdrant-url")
```

### 5.2 Deploy Cloud Run Service

```bash
# Deploy to Cloud Run
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
  --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,QDRANT_API_KEY=qdrant-api-key:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest"
```

**Note**: Cloud Run has CPU/memory/concurrency constraints:
- **0.25 CPU**: 128Mi - 512Mi memory, concurrency must be 1 (current configuration - cost-optimized)
- **1 CPU**: 128Mi - 4Gi memory, concurrency up to 80 (recommended for video/image processing)
- **2+ CPU**: 512Mi - 8Gi memory, concurrency up to 80 (for heavy workloads)

**Important**: With CPU < 1, concurrency must be 1. For higher concurrency, increase CPU to at least 1.

If you need more memory or higher concurrency (e.g., for processing videos/images), increase CPU:
```bash
# Alternative with more resources (allows higher concurrency)
--memory 2Gi \
--cpu 1 \
--concurrency 80 \
```

```bash
# Get Cloud Run URL
export CLOUD_RUN_URL=$(gcloud run services describe instagram-bot \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)")

echo "Cloud Run URL: $CLOUD_RUN_URL"
```

---

## Step 6: Set Up VPC Connector (For Self-Hosted Qdrant Only)

**Skip this step if you're using Qdrant Cloud (Option A)**

If you deployed Qdrant on a VM, Cloud Run needs VPC access to reach it:

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
  --vpc-egress=all \
  --region=us-central1 \
  --platform=managed
```

**Note**: VPC connector costs ~$10-15/month. Consider this in your cost calculations.

---

## Step 7: Configure Custom Domain (Optional)

### 7.1 Map Domain to Cloud Run

```bash
# Map domain
gcloud run domain-mappings create \
  --service instagram-bot \
  --domain yourdomain.com \
  --region us-central1 \
  --platform managed

# Get DNS records
gcloud run domain-mappings describe yourdomain.com \
  --region us-central1 \
  --platform managed \
  --format="value(status.resourceRecords)"
```

### 7.2 Add DNS Records

Add the DNS records shown above to your domain registrar. SSL certificate will be automatically provisioned by Google (takes 10-60 minutes).

---

## Step 8: Verify Vector Cache Setup

### 8.1 Check Application Logs

```bash
# View Cloud Run logs
gcloud run services logs read instagram-bot \
  --region us-central1 \
  --limit 50

# Look for these log messages:
# ✅ [VECTOR_CACHE] Qdrant client connected successfully
# ✅ [VECTOR_CACHE] Embedding pipeline loaded successfully
# ✅ [VECTOR_CACHE] Collection fact_checks created successfully
```

### 8.2 Test Health Endpoint

```bash
# Test health endpoint
curl $CLOUD_RUN_URL/health

# Should return:
# {"status":"healthy","timestamp":"..."}
```

### 8.3 Test Qdrant Connection

```bash
# For Qdrant Cloud - test directly
curl https://your-cluster.qdrant.io/collections

# For self-hosted - test from Cloud Run (check logs)
# The application will automatically test connection on startup
```

---

## Step 9: Configure Webhooks

### 9.1 Instagram Webhook

1. **In Facebook Developer Console**:
   - Go to your Instagram App
   - Settings → Basic → Add Instagram Product
   - Configure Webhooks:
     - **Callback URL**: `https://yourdomain.com/webhook` (or `$CLOUD_RUN_URL/webhook`)
     - **Verify Token**: (same as `instagram-verify-token` secret)
   - Subscribe to events:
     - `messages`
     - `messaging_postbacks`

2. **Test Webhook**:
   ```bash
   # Get verify token
   VERIFY_TOKEN=$(gcloud secrets versions access latest --secret="instagram-verify-token")
   
   # Test verification
   curl -X GET "$CLOUD_RUN_URL/webhook?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=test"
   ```

### 9.2 WhatsApp Webhook

1. **In Meta Business Suite**:
   - Go to WhatsApp → Configuration → Webhooks
   - **Callback URL**: `https://yourdomain.com/whatsapp-webhook` (or `$CLOUD_RUN_URL/whatsapp-webhook`)
   - **Verify Token**: (same as `whatsapp-verify-token` secret)
   - Subscribe to events:
     - `messages`
     - `message_status`

2. **Test Webhook**:
   ```bash
   # Get verify token
   VERIFY_TOKEN=$(gcloud secrets versions access latest --secret="whatsapp-verify-token")
   
   # Test verification
   curl -X GET "$CLOUD_RUN_URL/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=test"
   ```

---

## Step 10: Monitor and Maintain

### 10.1 View Logs

```bash
# View recent logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50

# Follow logs in real-time
gcloud run services logs read instagram-bot --region us-central1 --follow

# Filter for vector cache logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=instagram-bot AND textPayload=~\"[VECTOR_CACHE]\"" --limit 50
```

### 10.2 Check Vector Cache Statistics

The application includes a cleanup job that runs every 30 minutes. Monitor logs to see:

```
[CLEANUP] Starting vector cache cleanup...
[CLEANUP] Cleanup complete: X/Y entries removed
```

### 10.3 Monitor Qdrant (Self-Hosted)

```bash
# SSH into Qdrant VM
gcloud compute ssh qdrant-vm --zone=us-central1-a

# Check Qdrant container status
sudo docker ps

# View Qdrant logs
sudo docker logs qdrant

# Check Qdrant health
curl http://localhost:6333/health

# Check collection stats
curl http://localhost:6333/collections/fact_checks
```

---

## Environment Variables Reference

Your application uses these environment variables for vector caching:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `QDRANT_URL` | ✅ Yes | Qdrant server URL | `https://cluster.qdrant.io` or `http://10.x.x.x:6333` |
| `QDRANT_API_KEY` | ⚠️ Optional | API key for Qdrant Cloud | `your-api-key` |
| `VECTOR_CACHE_COLLECTION` | ⚠️ Optional | Collection name (default: `fact_checks`) | `fact_checks` |
| `NODE_ENV` | ✅ Yes | Environment (set to `production`) | `production` |
| `PORT` | ⚠️ Auto-set | Server port (automatically set by Cloud Run, do NOT configure) | N/A |

**Vector Cache Configuration** (in code, not configurable via env):
- **Similarity Threshold**: `0.85` (85% similarity required)
- **Freshness Threshold**: `30 minutes` (cache valid for 30 min)
- **Expiration Time**: `1 hour` (entries expire after 1 hour)
- **Vector Size**: `384` (all-MiniLM-L6-v2 embedding model)

---

## Cost Estimation

### Option A: Qdrant Cloud

**Small Scale** (< 1,000 requests/day):
- Cloud Run: ~$10-20/month
- Qdrant Cloud (Free tier): $0/month
- Domain: ~$12/year (~$1/month)
- **Total: ~$11-21/month**

**Medium Scale** (1,000-10,000 requests/day):
- Cloud Run: ~$30-50/month
- Qdrant Cloud (Starter): ~$25/month
- Domain: ~$1/month
- **Total: ~$56-76/month**

### Option B: Self-Hosted Qdrant

**Small Scale** (< 1,000 requests/day):
- Cloud Run: ~$10-20/month
- Qdrant VM (e2-medium): ~$15/month
- VPC Connector: ~$10/month
- Domain: ~$1/month
- **Total: ~$36-46/month**

**Medium Scale** (1,000-10,000 requests/day):
- Cloud Run: ~$30-50/month
- Qdrant VM (e2-medium): ~$25/month
- VPC Connector: ~$10/month
- Domain: ~$1/month
- **Total: ~$66-86/month**

**Recommendation**: Start with Qdrant Cloud (Option A) for easier management and lower initial costs.

---

## Troubleshooting

### Vector Cache Not Initializing

**Symptoms**: Logs show `[VECTOR_CACHE] ❌ Initialization failed`

**Solutions**:
1. **Check QDRANT_URL**:
   ```bash
   gcloud run services describe instagram-bot \
     --region us-central1 \
     --format="value(spec.template.spec.containers[0].env)"
   ```

2. **Verify Qdrant is accessible**:
   - **Qdrant Cloud**: Check cluster status in Qdrant Cloud console
   - **Self-Hosted**: SSH into VM and check `curl http://localhost:6333/health`

3. **Check VPC Connector** (self-hosted):
   ```bash
   gcloud compute networks vpc-access connectors describe qdrant-connector \
     --region=us-central1
   ```

### Out of Memory Errors

**Symptoms**: Cloud Run crashes or shows memory errors

**Solution**: Increase memory allocation:
```bash
gcloud run services update instagram-bot \
  --memory 8Gi \
  --region us-central1 \
  --platform managed
```

### Slow Response Times

**Possible Causes**:
1. Embedding model loading (first request)
2. Cold start (if min-instances=0)
3. Qdrant connection issues

**Solutions**:
1. Set `--min-instances=1` to avoid cold starts
2. Increase CPU allocation
3. Check Qdrant performance

### Qdrant Connection Timeouts

**Symptoms**: `[VECTOR_CACHE] ❌ Error searching similar claims: timeout`

**Solutions**:
1. **Qdrant Cloud**: Check cluster status and scaling
2. **Self-Hosted**: 
   - Check VM is running: `gcloud compute instances list`
   - Check firewall rules
   - Verify VPC connector is healthy

---

## Quick Reference Commands

### Deploy New Version

```bash
# Build and push
docker build -t gcr.io/$PROJECT_ID/instagram-bot:latest .
docker push gcr.io/$PROJECT_ID/instagram-bot:latest

# Deploy
gcloud run deploy instagram-bot \
  --image gcr.io/$PROJECT_ID/instagram-bot:latest \
  --region us-central1
```

### Update Environment Variables

```bash
# Update QDRANT_URL
gcloud run services update instagram-bot \
  --update-env-vars="QDRANT_URL=new-url" \
  --region us-central1
```

### Update Secrets

```bash
# Add new secret version
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Redeploy to pick up new secret
gcloud run deploy instagram-bot --region us-central1
```

### Scale Service

```bash
# Manual scaling
gcloud run services update instagram-bot \
  --min-instances=2 \
  --max-instances=10 \
  --region us-central1
```

### View Service Status

```bash
# Describe service
gcloud run services describe instagram-bot --region us-central1

# View logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50
```

---

## Next Steps Checklist

- [ ] GCP project created and billing enabled
- [ ] Required APIs enabled
- [ ] Qdrant deployed (Cloud or Self-Hosted)
- [ ] All secrets created in Secret Manager
- [ ] Cloud Run service account has access to secrets
- [ ] Docker image built and pushed
- [ ] Cloud Run service deployed
- [ ] VPC connector created (if self-hosted Qdrant)
- [ ] Custom domain mapped (optional)
- [ ] SSL certificate provisioned (automatic)
- [ ] Instagram webhook configured
- [ ] WhatsApp webhook configured (optional)
- [ ] Health endpoint tested
- [ ] Vector cache initialization verified in logs
- [ ] Monitoring set up

---

## Summary

Your GCP server is now set up with:

✅ **Vector Database Caching**: Qdrant storing fact-check embeddings  
✅ **Auto-scaling**: Cloud Run scales automatically  
✅ **High Availability**: Managed services with redundancy  
✅ **Cost Optimized**: Pay only for what you use  
✅ **Production Ready**: SSL, monitoring, and logging configured  

Your bot will now cache fact-check results, reducing API costs and improving response times! 🚀

---

## Additional Resources

- [Qdrant Cloud Documentation](https://cloud.qdrant.io/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [VPC Access Connector Documentation](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access)

