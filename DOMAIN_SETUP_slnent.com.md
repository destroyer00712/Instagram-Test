# Domain Setup for slnent.com

## ⏱️ Timeline Estimate

**Total Time: 15-60 minutes** (mostly waiting)
- Creating domain mapping: 2-3 minutes
- Adding DNS records: 2-5 minutes (your action)
- DNS propagation: 5-60 minutes (automatic wait)
- SSL certificate: 10-60 minutes (automatic, after DNS)

## Quick Setup Steps

### Step 1: Create Domain Mapping (Run this once)

```bash
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"
gcloud beta run domain-mappings create \
  --service instagram-bot \
  --domain slnent.com \
  --region us-central1 \
  --platform managed
```

If it says domain needs verification, you can skip verification and just add the DNS records directly.

### Step 2: Get DNS Records

After creating the mapping (wait 30 seconds), run:

```bash
gcloud beta run domain-mappings describe slnent.com \
  --region us-central1 \
  --platform managed \
  --format="table(status.resourceRecords.name,status.resourceRecords.rrdata,status.resourceRecords.type)"
```

This will show you DNS records like:
```
NAME           RRDATA                      TYPE
slnent.com.    ghs.googlehosted.com.       CNAME
```

### Step 3: Add DNS Record at Your Registrar

Go to your domain registrar's DNS settings and add:

**Type**: CNAME (or A record if it shows an IP)
**Name/Host**: `slnent.com` or `@` (root domain)
**Value/Target**: The value from the RRDATA column above
**TTL**: 3600 or default

### Step 4: Wait

- DNS propagation: 5-60 minutes
- SSL certificate: Auto-provisions after DNS (10-60 minutes)

## Alternative: Manual DNS Record

If the commands get stuck, you can try manually:

**Add this CNAME record:**
- Name: `@` or `slnent.com`
- Value: `ghs.googlehosted.com.`
- Type: CNAME

Then check status:
```bash
gcloud beta run domain-mappings list --platform managed
```

## Check Status

```bash
gcloud beta run domain-mappings describe slnent.com \
  --region us-central1 \
  --platform managed
```

Look for status: `ACTIVE` means it's working!

## After Setup

Your webhooks will be:
- Instagram: `https://slnent.com/webhook`
- WhatsApp: `https://slnent.com/whatsapp-webhook`

