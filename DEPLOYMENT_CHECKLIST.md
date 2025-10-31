# Quick Deployment Checklist
## Instagram & WhatsApp Fact-Checking Bot on GCP

Use this checklist to ensure you complete all deployment steps correctly.

---

## Pre-Deployment Checklist

### Prerequisites
- [ ] GCP account created with billing enabled
- [ ] Domain name purchased/available
- [ ] `gcloud` CLI installed and authenticated
- [ ] Docker installed locally
- [ ] Instagram Business Account ready
- [ ] Meta Business Account ready (for WhatsApp)
- [ ] Qdrant Cloud account created (free tier) - https://cloud.qdrant.io/

### API Keys & Credentials Ready
- [ ] Instagram Access Token
- [ ] Instagram App Secret
- [ ] Instagram Webhook Verify Token
- [ ] Gemini API Key
- [ ] Google Custom Search API Key
- [ ] Google Custom Search Engine ID
- [ ] WhatsApp Access Token
- [ ] WhatsApp Verify Token
- [ ] WhatsApp Phone Number ID
- [ ] Qdrant Cloud Cluster URL
- [ ] Qdrant Cloud API Key

---

## Deployment Steps Checklist

### Step 1: GCP Project Setup
- [ ] Project created: `instagram-fact-check-bot`
- [ ] Project set as default
- [ ] Billing account linked
- [ ] All required APIs enabled:
  - [ ] Cloud Run API
  - [ ] Cloud Build API
  - [ ] Container Registry API
  - [ ] Secret Manager API
  - [ ] Cloud DNS API
  - [ ] Compute Engine API

### Step 2: Qdrant Cloud Setup
- [ ] Account created at https://cloud.qdrant.io/
- [ ] Free tier cluster created
- [ ] Cluster URL copied
- [ ] API key generated and copied
- [ ] Cluster URL stored in Secret Manager: `qdrant-url`
- [ ] API key stored in Secret Manager: `qdrant-api-key`

### Step 3: Secrets Configuration
- [ ] All 12 secrets created in Secret Manager:
  - [ ] `instagram-access-token`
  - [ ] `instagram-app-secret`
  - [ ] `instagram-verify-token`
  - [ ] `gemini-api-key`
  - [ ] `google-search-api-key`
  - [ ] `google-search-engine-id`
  - [ ] `whatsapp-access-token`
  - [ ] `whatsapp-verify-token`
  - [ ] `whatsapp-phone-number-id`
  - [ ] `qdrant-api-key`
  - [ ] `qdrant-url`
  - [ ] `vector-cache-collection`
- [ ] Cloud Run service account granted access to all secrets

### Step 4: Docker Image
- [ ] Docker image built successfully
- [ ] Image pushed to `gcr.io/PROJECT_ID/instagram-bot:latest`
- [ ] Image verified in Container Registry

### Step 5: Cloud Run Deployment
- [ ] Service deployed to Cloud Run
- [ ] Configuration verified:
  - [ ] Memory: 4Gi
  - [ ] CPU: 2
  - [ ] Timeout: 300s
  - [ ] Min instances: 1
  - [ ] Max instances: 10
  - [ ] Concurrency: 80
- [ ] All environment variables set
- [ ] All secrets connected
- [ ] Health endpoint responding: `/health`

### Step 6: Domain & SSL
- [ ] Domain mapped to Cloud Run service
- [ ] DNS records obtained from Cloud Run
- [ ] DNS records added at domain registrar:
  - [ ] CNAME record added
  - [ ] TTL set to 300 (or default)
- [ ] DNS propagation verified (can take up to 48 hours)
- [ ] SSL certificate automatically provisioned
- [ ] HTTPS endpoint tested: `https://yourdomain.com/health`

### Step 7: Instagram Webhook
- [ ] Webhook URL configured: `https://yourdomain.com/webhook`
- [ ] Verify token set (matches secret)
- [ ] Events subscribed:
  - [ ] `messages`
  - [ ] `messaging_postbacks`
- [ ] Webhook verification tested
- [ ] Test message sent and received

### Step 8: WhatsApp Webhook
- [ ] Webhook URL configured: `https://yourdomain.com/whatsapp-webhook`
- [ ] Verify token set (matches secret)
- [ ] Events subscribed:
  - [ ] `messages`
  - [ ] `message_status`
- [ ] Webhook verification tested
- [ ] Test message sent and received

### Step 9: Testing & Verification
- [ ] Health endpoint: `curl https://yourdomain.com/health`
- [ ] Instagram webhook verification: `curl "https://yourdomain.com/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test"`
- [ ] WhatsApp webhook verification: `curl "https://yourdomain.com/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test"`
- [ ] Instagram test message sent and processed
- [ ] WhatsApp test message sent and processed
- [ ] Qdrant caching verified (first request slower, second similar request faster)
- [ ] Logs checked for errors

### Step 10: Monitoring Setup
- [ ] Cloud Logging enabled
- [ ] Logs accessible via console
- [ ] Alerts configured (optional)
- [ ] Performance metrics monitored

---

## Post-Deployment Checklist

### Verification
- [ ] Bot responds to Instagram messages
- [ ] Bot responds to WhatsApp messages
- [ ] Fact-checking works correctly
- [ ] Vector caching is working (check logs for cache hits)
- [ ] No errors in Cloud Run logs
- [ ] Domain resolves correctly
- [ ] SSL certificate valid

### Documentation
- [ ] Webhook URLs documented
- [ ] Secrets location documented
- [ ] Deployment process documented
- [ ] Troubleshooting steps documented

### Monitoring
- [ ] Set up log-based alerts for errors
- [ ] Monitor request count
- [ ] Monitor error rate (< 1%)
- [ ] Monitor latency (< 30s for new, < 5s for cached)
- [ ] Monitor memory usage (< 80%)
- [ ] Monitor CPU usage (< 70%)

---

## Quick Command Reference

### Deploy Everything
```bash
# Using deployment script
./deploy-gcp.sh

# Or with domain
DOMAIN_NAME=yourdomain.com ./deploy-gcp.sh
```

### View Status
```bash
# Service status
gcloud run services describe instagram-bot --region us-central1

# View logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50

# Follow logs
gcloud run services logs read instagram-bot --region us-central1 --follow
```

### Update Secrets
```bash
# Add new version
echo -n "new_value" | gcloud secrets versions add SECRET_NAME --data-file=-

# Update Cloud Run to use latest
gcloud run services update instagram-bot \
  --update-secrets="SECRET_NAME=SECRET_NAME:latest" \
  --region us-central1
```

### Test Endpoints
```bash
# Health check
curl https://yourdomain.com/health

# Instagram webhook
curl "https://yourdomain.com/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test"

# WhatsApp webhook
curl "https://yourdomain.com/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test"
```

---

## Troubleshooting Quick Checks

### If Webhooks Not Working
1. [ ] Verify domain is mapped correctly
2. [ ] Check DNS records are correct
3. [ ] Test webhook verification endpoint manually
4. [ ] Check Cloud Run logs for errors
5. [ ] Verify SSL certificate is valid

### If Qdrant Not Connecting
1. [ ] Verify Qdrant URL is correct
2. [ ] Check API key is valid
3. [ ] Test Qdrant connection manually
4. [ ] Check Cloud Run logs for connection errors
5. [ ] Verify secrets are accessible

### If High Latency
1. [ ] Check if Qdrant caching is working
2. [ ] Increase CPU allocation
3. [ ] Increase memory allocation
4. [ ] Check Cloud Run logs for bottlenecks
5. [ ] Monitor instance count (may need more instances)

---

## Cost Monitoring

### Expected Monthly Costs
- [ ] Cloud Run: ~$10-50/month (depending on usage)
- [ ] Qdrant Cloud Free: $0/month ✅
- [ ] Secret Manager: ~$0.78/month
- [ ] Domain: ~$1/month
- [ ] Total: ~$12-52/month

### Cost Optimization
- [ ] Set appropriate min/max instances
- [ ] Monitor and optimize memory/CPU
- [ ] Use Qdrant Cloud free tier
- [ ] Monitor Cloud Run usage patterns

---

## Security Checklist

- [ ] All secrets stored in Secret Manager (not in code)
- [ ] No secrets committed to git
- [ ] Cloud Run service account has minimal permissions
- [ ] Webhook verification tokens are secure
- [ ] Domain uses HTTPS (SSL enabled)
- [ ] Logs don't contain sensitive data
- [ ] IAM roles properly configured

---

## Success Criteria

✅ **Deployment is successful when:**
- [ ] All checklist items completed
- [ ] Bot responds to Instagram messages
- [ ] Bot responds to WhatsApp messages
- [ ] Fact-checking works correctly
- [ ] Vector caching is active
- [ ] No errors in logs
- [ ] Domain resolves correctly
- [ ] SSL certificate valid
- [ ] Webhooks verified and working

---

**🎉 Once all items are checked, your deployment is complete!**
