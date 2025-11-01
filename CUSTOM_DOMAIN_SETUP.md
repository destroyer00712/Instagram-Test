# Custom Domain Setup Guide

This guide will help you connect your custom domain to Cloud Run with automatic HTTPS/SSL.

## Prerequisites

- ✅ Cloud Run service deployed (already done: `instagram-bot`)
- ✅ Domain name registered with a registrar
- ✅ Access to your domain's DNS settings

---

## Quick Setup

### Step 1: Run the Setup Script

```bash
./scripts/setup-custom-domain.sh yourdomain.com
```

Replace `yourdomain.com` with your actual domain (e.g., `bot.example.com` or `api.yourdomain.com`)

### Step 2: Add DNS Records

The script will output DNS records that look like:

```
NAME                  RRDATA                          TYPE
yourdomain.com.       ghs.googlehosted.com.           CNAME
```

**Add these records in your domain registrar's DNS settings:**

1. Log into your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)
2. Go to DNS Management / DNS Settings
3. Add a new record:
   - **Type**: CNAME (or A record if specified)
   - **Name/Host**: The name from the output (e.g., `yourdomain.com` or `@`)
   - **Value/Target**: The value from RRDATA column
   - **TTL**: 3600 (or use default)

### Step 3: Wait for Propagation

- DNS propagation: **5-60 minutes**
- SSL certificate provisioning: **10-60 minutes** (automatic, no action needed)

**Total wait time**: Usually 15-60 minutes

---

## Manual Setup (Alternative)

If you prefer to do it manually:

```bash
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

# Create domain mapping
gcloud run domain-mappings create \
  --service instagram-bot \
  --domain yourdomain.com \
  --region us-central1 \
  --platform managed

# Get DNS records
gcloud run domain-mappings describe yourdomain.com \
  --region us-central1 \
  --platform managed \
  --format="table(status.resourceRecords.name,status.resourceRecords.rrdata,status.resourceRecords.type)"
```

---

## Check Status

### Check Domain Mapping Status

```bash
gcloud run domain-mappings describe yourdomain.com \
  --region us-central1 \
  --platform managed
```

**Status indicators:**
- `ACTIVE` - ✅ Domain is fully configured and working
- `PENDING` - ⏳ Waiting for DNS configuration or SSL provisioning
- `NONE` - ⚠️ DNS not configured or not propagated yet

### Test DNS Propagation

```bash
# Check if DNS is pointing to Google
dig yourdomain.com +short
# Should show: ghs.googlehosted.com or similar
```

---

## SSL Certificate

✅ **Automatic**: Google Cloud automatically provisions and renews SSL certificates

- Certificate is managed by Google
- Automatically renewed before expiration
- No additional cost
- Supports HTTPS only (HTTP redirects to HTTPS)

---

## Common Issues

### 1. DNS Records Not Propagating

**Solution:**
- Wait longer (up to 48 hours for full propagation)
- Check TTL value (lower TTL = faster updates)
- Verify records are correct (no typos, correct type)

### 2. SSL Certificate Not Provisioning

**Solution:**
- Ensure DNS is fully propagated first
- Wait up to 60 minutes
- Check domain mapping status: `gcloud run domain-mappings describe`
- Ensure domain is publicly accessible (not behind firewall)

### 3. Domain Shows as "PENDING"

**Solution:**
- Verify DNS records are added correctly
- Wait for propagation (can take up to 48 hours)
- Check for typos in domain name

### 4. HTTPS Not Working

**Solution:**
- SSL provisioning takes 10-60 minutes after DNS is configured
- Cloud Run automatically redirects HTTP → HTTPS
- Wait for certificate to be fully provisioned

---

## After Setup

Once your domain is active, update your webhook configurations:

### Instagram Webhook
- New URL: `https://yourdomain.com/webhook`
- Update in: [Facebook Developers Console](https://developers.facebook.com/)

### WhatsApp Webhook
- New URL: `https://yourdomain.com/whatsapp-webhook`
- Update in: [Meta Business Suite](https://business.facebook.com/)

### Verify It Works

```bash
# Test health endpoint
curl https://yourdomain.com/health

# Expected response:
# {"status":"healthy","timestamp":"..."}
```

---

## Subdomain vs Root Domain

### Using Root Domain (yourdomain.com)
- ✅ Works with both `yourdomain.com` and `www.yourdomain.com`
- ⚠️ May need additional DNS records for www subdomain

### Using Subdomain (bot.yourdomain.com)
- ✅ Easier to manage
- ✅ Recommended for API/webhook endpoints
- ✅ Doesn't affect main website

**Recommendation**: Use a subdomain like `bot.yourdomain.com` or `api.yourdomain.com` for your webhooks.

---

## Cost

- **Domain registration**: Varies by registrar (~$10-15/year)
- **Cloud Run domain mapping**: **FREE**
- **SSL certificate**: **FREE** (automatically provisioned)
- **No additional GCP costs**

---

## Troubleshooting Commands

```bash
# List all domain mappings
gcloud run domain-mappings list --region us-central1 --platform managed

# Describe specific domain
gcloud run domain-mappings describe yourdomain.com \
  --region us-central1 \
  --platform managed

# Delete domain mapping (if needed to start over)
gcloud run domain-mappings delete yourdomain.com \
  --region us-central1 \
  --platform managed

# Check Cloud Run service
gcloud run services describe instagram-bot \
  --region us-central1 \
  --platform managed
```

---

## Need Help?

1. Check domain mapping status first
2. Verify DNS records are correct
3. Wait for propagation (can take up to 48 hours)
4. Check Cloud Run logs if service isn't responding

