# Complete GCP Deployment Guide
## Instagram & WhatsApp Fact-Checking Bot with Qdrant Cloud Free Tier

This guide will help you deploy your Instagram & WhatsApp fact-checking bot to Google Cloud Platform with:
- ✅ Scalable Cloud Run architecture (auto-scaling)
- ✅ Qdrant Cloud free tier (vector caching)
- ✅ Custom domain with SSL
- ✅ Instagram webhook support
- ✅ WhatsApp webhook support
- ✅ Production-ready setup

---

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Google Cloud Platform account with billing enabled
- [ ] Domain name (e.g., `yourdomain.com`)
- [ ] Google Cloud SDK (`gcloud`) installed
- [ ] Docker installed locally
- [ ] Instagram Business Account
- [ ] Meta Business Account (for WhatsApp)
- [ ] Qdrant Cloud account (free tier) - https://cloud.qdrant.io/

---

## Step 1: Initial GCP Project Setup

### 1.1 Create and Configure GCP Project

```bash
# Login to Google Cloud
gcloud auth login

# Create new project (or use existing)
gcloud projects create instagram-fact-check-bot \
  --name="Instagram & WhatsApp Fact Check Bot"

# Set as default project
gcloud config set project instagram-fact-check-bot

# Enable billing (replace BILLING_ACCOUNT_ID)
gcloud billing projects link instagram-fact-check-bot \
  --billing-account=BILLING_ACCOUNT_ID

# Verify project
gcloud config get-value project
```

### 1.2 Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  dns.googleapis.com \
  compute.googleapis.com

# Verify APIs are enabled
gcloud services list --enabled | grep -E "(run|cloudbuild|secretmanager|dns)"
```

---

## Step 2: Set Up Qdrant Cloud (Free Tier)

### 2.1 Create Qdrant Cloud Account

1. **Sign up**: Go to https://cloud.qdrant.io/
2. **Create account**: Use email or GitHub
3. **Create cluster**:
   - Click "Create Cluster"
   - Choose **Free Tier** (1GB RAM, 1GB storage)
   - Select region closest to your GCP region (e.g., `us-central1`)
   - Click "Create"

### 2.2 Get Qdrant Credentials

1. **Get Cluster URL**:
   - In Qdrant Cloud dashboard, click on your cluster
   - Copy the **Cluster URL** (e.g., `https://xxxxx-xxxxx.us-central1-0.gcp.cloud.qdrant.io`)

2. **Get API Key**:
   - Go to "API Keys" section
   - Click "Create API Key"
   - Copy the API key (save it securely!)

### 2.3 Store Qdrant Credentials in GCP Secret Manager

```bash
# Store Qdrant API key
echo -n "YOUR_QDRANT_API_KEY" | gcloud secrets create qdrant-api-key --data-file=-

# Store Qdrant URL (optional, can be env var)
echo -n "YOUR_QDRANT_CLUSTER_URL" | gcloud secrets create qdrant-url --data-file=-
```

**Important**: Replace `YOUR_QDRANT_API_KEY` and `YOUR_QDRANT_CLUSTER_URL` with your actual values.

---

## Step 3: Set Up Application Secrets

### 3.1 Create All Required Secrets

```bash
# Instagram API Secrets
echo -n "your_instagram_access_token" | gcloud secrets create instagram-access-token --data-file=-
echo -n "your_instagram_app_secret" | gcloud secrets create instagram-app-secret --data-file=-
echo -n "your_instagram_verify_token" | gcloud secrets create instagram-verify-token --data-file=-

# Google API Secrets (Gemini & Search)
echo -n "your_gemini_api_key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your_google_search_api_key" | gcloud secrets create google-search-api-key --data-file=-
echo -n "your_google_search_engine_id" | gcloud secrets create google-search-engine-id --data-file=-

# WhatsApp API Secrets (Meta Business)
echo -n "your_whatsapp_access_token" | gcloud secrets create whatsapp-access-token --data-file=-
echo -n "your_whatsapp_verify_token" | gcloud secrets create whatsapp-verify-token --data-file=-
echo -n "your_whatsapp_phone_number_id" | gcloud secrets create whatsapp-phone-number-id --data-file=-

# Qdrant Configuration
echo -n "fact_checks" | gcloud secrets create vector-cache-collection --data-file=-
```

**Note**: Replace all `your_*` values with your actual API keys and tokens.

### 3.2 Grant Cloud Run Access to Secrets

```bash
# Get Cloud Run service account
export PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
export SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to all secrets
for secret in instagram-access-token instagram-app-secret instagram-verify-token \
              gemini-api-key google-search-api-key google-search-engine-id \
              whatsapp-access-token whatsapp-verify-token whatsapp-phone-number-id \
              qdrant-api-key qdrant-url vector-cache-collection; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done

echo "✅ All secrets configured"
```

---

## Step 4: Build and Push Docker Image

### 4.1 Configure Docker for GCP

```bash
# Authenticate Docker with GCP
gcloud auth configure-docker

# Set project variables
export PROJECT_ID=$(gcloud config get-value project)
export QDRANT_URL="YOUR_QDRANT_CLUSTER_URL"  # From Step 2.2
```

### 4.2 Build and Push Image

```bash
# Build Docker image
docker build -t gcr.io/$PROJECT_ID/instagram-bot:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/instagram-bot:latest

# Verify image is pushed
gcloud container images list --repository=gcr.io/$PROJECT_ID
```

---

## Step 5: Deploy to Cloud Run

### 5.1 Deploy Application

```bash
# Deploy to Cloud Run with all configuration
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
  --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest,INSTAGRAM_APP_SECRET=instagram-app-secret:latest,INSTAGRAM_VERIFY_TOKEN=instagram-verify-token:latest,GEMINI_API_KEY=gemini-api-key:latest,GOOGLE_CUSTOM_SEARCH_API_KEY=google-search-api-key:latest,GOOGLE_CUSTOM_SEARCH_ENGINE_ID=google-search-engine-id:latest,WHATSAPP_ACCESS_TOKEN=whatsapp-access-token:latest,WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token:latest,WHATSAPP_PHONE_NUMBER_ID=whatsapp-phone-number-id:latest,QDRANT_API_KEY=qdrant-api-key:latest,VECTOR_CACHE_COLLECTION=vector-cache-collection:latest"

# Get Cloud Run URL
export CLOUD_RUN_URL=$(gcloud run services describe instagram-bot \
  --platform managed \
  --region us-central1 \
  --format="value(status.url)")

echo "✅ Application deployed at: $CLOUD_RUN_URL"
```

### 5.2 Verify Deployment

```bash
# Test health endpoint
curl $CLOUD_RUN_URL/health

# View logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50
```

---

## Step 6: Set Up Custom Domain & SSL

### 6.1 Map Domain to Cloud Run

```bash
# Map your domain
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

**Important**: Copy the DNS records shown above.

### 6.2 Configure DNS at Your Domain Registrar

1. **Log in** to your domain registrar (GoDaddy, Namecheap, etc.)
2. **Go to DNS settings**
3. **Add the DNS records** from Step 6.1:
   - Type: `CNAME`
   - Name: `@` (or leave blank)
   - Value: (from Cloud Run output)
   - TTL: `300` (5 minutes)

4. **Wait for DNS propagation** (can take 5 minutes to 48 hours)

### 6.3 Verify SSL Certificate

```bash
# Check domain mapping status
gcloud run domain-mappings describe yourdomain.com \
  --region us-central1 \
  --platform managed

# SSL certificate is automatically provisioned by Google
# Test HTTPS endpoint
curl https://yourdomain.com/health
```

---

## Step 7: Configure Instagram Webhook

### 7.1 Get Webhook URL

Your webhook URL will be:
- **Production**: `https://yourdomain.com/webhook`
- **Testing**: `$CLOUD_RUN_URL/webhook`

### 7.2 Configure in Facebook Developer Console

1. **Go to Facebook Developers**: https://developers.facebook.com/
2. **Select your Instagram App**
3. **Go to**: Settings → Basic → Add Instagram Product
4. **Configure Webhooks**:
   - Navigate to: Products → Instagram → Webhooks
   - **Callback URL**: `https://yourdomain.com/webhook`
   - **Verify Token**: (same as `instagram-verify-token` secret)
   - **Subscription Fields**: 
     - ✅ `messages`
     - ✅ `messaging_postbacks`

5. **Test Webhook**:
```bash
# Test verification endpoint
curl "https://yourdomain.com/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

Expected response: `test123`

---

## Step 8: Configure WhatsApp Webhook

### 8.1 Get Webhook URL

Your WhatsApp webhook URL will be:
- **Production**: `https://yourdomain.com/whatsapp-webhook`
- **Testing**: `$CLOUD_RUN_URL/whatsapp-webhook`

### 8.2 Configure in Meta Business Suite

1. **Go to Meta Business Suite**: https://business.facebook.com/
2. **Navigate to**: WhatsApp → Configuration → Webhooks
3. **Configure Webhook**:
   - **Callback URL**: `https://yourdomain.com/whatsapp-webhook`
   - **Verify Token**: (same as `whatsapp-verify-token` secret)
   - **Subscribe to events**:
     - ✅ `messages`
     - ✅ `message_status`

4. **Test Webhook**:
```bash
# Test verification endpoint
curl "https://yourdomain.com/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

Expected response: `test123`

---

## Step 9: Verify Everything Works

### 9.1 Test Endpoints

```bash
# Health check
curl https://yourdomain.com/health

# Instagram webhook verification
curl "https://yourdomain.com/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"

# WhatsApp webhook verification
curl "https://yourdomain.com/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
```

### 9.2 Test Fact-Checking

1. **Send a test message** to your Instagram account
2. **Check Cloud Run logs**:
```bash
gcloud run services logs read instagram-bot --region us-central1 --limit 100 --follow
```

3. **Verify Qdrant caching**:
   - First request should process normally
   - Second similar request should be faster (cached)

---

## Step 10: Set Up Monitoring & Alerts

### 10.1 Enable Cloud Monitoring

```bash
# Cloud Monitoring is enabled by default
# View metrics in Cloud Console:
# https://console.cloud.google.com/monitoring
```

### 10.2 Set Up Log-Based Alerts

```bash
# Create alert for errors
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Instagram Bot Errors" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s
```

### 10.3 Monitor Key Metrics

Monitor these in Cloud Console:
- **Request count**: Should increase with usage
- **Error rate**: Should be < 1%
- **Latency**: Should be < 30s for cached, < 5s for new
- **Memory usage**: Should be < 80%
- **CPU usage**: Should be < 70%

---

## Step 11: Set Up CI/CD (Optional but Recommended)

### 11.1 Configure Cloud Build

```bash
# Submit build using cloudbuild.yaml
gcloud builds submit --config cloudbuild.yaml

# Or connect to GitHub for automatic builds
gcloud builds triggers create github \
  --name="auto-deploy" \
  --repo-name="YOUR_REPO" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

Now every push to `main` branch will automatically deploy!

---

## Cost Breakdown

### Monthly Costs (Small Scale < 1,000 requests/day):

- **Cloud Run**: ~$10-20/month
  - Base: ~$0.40/million requests
  - CPU time: ~$0.00002400/vCPU-second
  - Memory: ~$0.00000250/GiB-second
- **Qdrant Cloud Free Tier**: **$0/month** ✅
- **Secret Manager**: ~$0.06/secret/month (13 secrets = ~$0.78/month)
- **Cloud Build**: ~$0.003/build-minute (free tier: 120 build-minutes/day)
- **Domain**: ~$12/year (~$1/month)
- **DNS/SSL**: Free with Cloud Run domain mapping

**Total: ~$12-22/month** 🎉

### Medium Scale (1,000-10,000 requests/day):

- **Cloud Run**: ~$30-50/month
- **Qdrant Cloud**: Still free tier (up to 10,000 cached queries)
- **Total: ~$32-52/month**

---

## Troubleshooting

### Issue: Webhook Not Receiving Requests

**Symptoms**: Instagram/WhatsApp not sending messages to your bot

**Solutions**:
1. **Verify webhook URL**:
   ```bash
   curl https://yourdomain.com/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test
   ```

2. **Check SSL certificate**:
   ```bash
   curl -v https://yourdomain.com/health
   ```

3. **Check Cloud Run logs**:
   ```bash
   gcloud run services logs read instagram-bot --region us-central1 --limit 100
   ```

4. **Verify domain is mapped**:
   ```bash
   gcloud run domain-mappings describe yourdomain.com --region us-central1
   ```

### Issue: Qdrant Connection Fails

**Symptoms**: Logs show "Qdrant client not initialized" or connection errors

**Solutions**:
1. **Verify Qdrant URL**:
   ```bash
   # Check environment variable
   gcloud run services describe instagram-bot --region us-central1 --format="value(spec.template.spec.containers[0].env)"
   ```

2. **Test Qdrant connection**:
   ```bash
   curl -H "api-key: YOUR_API_KEY" https://YOUR_CLUSTER.qdrant.io/health
   ```

3. **Check API key secret**:
   ```bash
   gcloud secrets versions access latest --secret="qdrant-api-key"
   ```

### Issue: Out of Memory Errors

**Symptoms**: Application crashes or shows memory errors

**Solutions**:
```bash
# Increase memory limit
gcloud run services update instagram-bot \
  --memory 8Gi \
  --region us-central1 \
  --platform managed
```

### Issue: High Latency

**Symptoms**: Requests taking too long

**Solutions**:
1. **Check if Qdrant caching is working**:
   - First request: ~30s (normal)
   - Similar request: ~2s (should be cached)

2. **Increase CPU**:
```bash
gcloud run services update instagram-bot \
  --cpu 4 \
  --region us-central1 \
  --platform managed
```

### Issue: Domain Not Resolving

**Symptoms**: Domain shows error or doesn't load

**Solutions**:
1. **Verify DNS records**:
   ```bash
   dig yourdomain.com CNAME
   ```

2. **Check domain mapping status**:
   ```bash
   gcloud run domain-mappings describe yourdomain.com --region us-central1
   ```

3. **Wait for DNS propagation** (can take up to 48 hours)

---

## Quick Reference Commands

### View Service Status
```bash
gcloud run services describe instagram-bot --region us-central1
```

### View Logs
```bash
# Recent logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50

# Follow logs in real-time
gcloud run services logs read instagram-bot --region us-central1 --follow
```

### Update Service
```bash
# Update environment variables
gcloud run services update instagram-bot \
  --update-env-vars="KEY=VALUE" \
  --region us-central1 \
  --platform managed

# Update secrets
gcloud run services update instagram-bot \
  --update-secrets="SECRET_NAME=secret-name:latest" \
  --region us-central1 \
  --platform managed
```

### Scale Service
```bash
# Set minimum instances
gcloud run services update instagram-bot \
  --min-instances=2 \
  --region us-central1 \
  --platform managed

# Set maximum instances
gcloud run services update instagram-bot \
  --max-instances=20 \
  --region us-central1 \
  --platform managed
```

### Redeploy Updated Image
```bash
# Build and push new image
docker build -t gcr.io/$PROJECT_ID/instagram-bot:latest .
docker push gcr.io/$PROJECT_ID/instagram-bot:latest

# Deploy new version
gcloud run deploy instagram-bot \
  --image gcr.io/$PROJECT_ID/instagram-bot:latest \
  --region us-central1 \
  --platform managed
```

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use Secret Manager** for all sensitive data
3. **Rotate secrets regularly**:
   ```bash
   # Add new version
   echo -n "new_value" | gcloud secrets versions add SECRET_NAME --data-file=-
   # Update Cloud Run to use latest
   gcloud run services update instagram-bot --update-secrets="SECRET_NAME=SECRET_NAME:latest"
   ```

4. **Enable Cloud Logging** for audit trails
5. **Use IAM roles** to limit access
6. **Enable Cloud Armor** for DDoS protection (optional)

---

## Next Steps After Deployment

1. ✅ **Monitor performance** for first week
2. ✅ **Set up alerts** for errors and latency
3. ✅ **Test both webhooks** thoroughly
4. ✅ **Verify Qdrant caching** is working
5. ✅ **Optimize costs** based on usage patterns
6. ✅ **Document** any custom configurations
7. ✅ **Set up backups** (if needed)

---

## Support & Resources

- **GCP Documentation**: https://cloud.google.com/docs
- **Cloud Run Documentation**: https://cloud.google.com/run/docs
- **Qdrant Cloud**: https://cloud.qdrant.io/
- **Instagram API**: https://developers.facebook.com/docs/instagram-api
- **WhatsApp API**: https://developers.facebook.com/docs/whatsapp

---

## Deployment Checklist

Use this checklist to ensure everything is set up:

- [ ] GCP project created and billing enabled
- [ ] All required APIs enabled
- [ ] Qdrant Cloud account created (free tier)
- [ ] Qdrant API key stored in Secret Manager
- [ ] All application secrets created in Secret Manager
- [ ] Cloud Run service account has access to secrets
- [ ] Docker image built and pushed
- [ ] Application deployed to Cloud Run
- [ ] Custom domain mapped
- [ ] DNS records added at registrar
- [ ] SSL certificate verified
- [ ] Instagram webhook configured
- [ ] WhatsApp webhook configured
- [ ] Both webhooks tested and verified
- [ ] Health endpoint responding
- [ ] Monitoring and alerts configured
- [ ] Logs accessible and monitored

---

**🎉 Congratulations! Your Instagram & WhatsApp fact-checking bot is now live on GCP with scalable architecture and vector caching!**
