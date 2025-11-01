# Manual Domain Setup Guide - GCP Console (Web Dashboard)

This guide walks you through setting up `slnent.com` with HTTPS using the Google Cloud Console (web interface).

## ⏱️ Timeline Estimate

**Total Time: 15-60 minutes**
- Setting up in console: 5-10 minutes
- Adding DNS records: 2-5 minutes
- DNS propagation: 5-60 minutes (automatic)
- SSL certificate: 10-60 minutes (automatic, after DNS)

---

## Step-by-Step Instructions

### Step 1: Open Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're in the correct project: **instagram-fact-check-bot**
   - If not, click the project dropdown at the top and select it

### Step 2: Navigate to Cloud Run Domain Mappings

1. In the left sidebar, go to **Cloud Run** (under "Serverless")
2. Click on **Domain mappings** (in the left menu under Cloud Run)
3. You should see a page with domain mappings (might be empty)

### Step 3: Create Domain Mapping

1. Click the **"CREATE DOMAIN MAPPING"** button at the top
2. Fill in the form:
   - **Domain name**: `slnent.com`
   - **Region**: `us-central1` (or select your Cloud Run region)
   - **Service**: Select `instagram-bot` from the dropdown
3. Click **"CREATE"** or **"SUBMIT"**

### Step 4: Wait for Provisioning (30-60 seconds)

- The console will show "Creating..." status
- Wait until you see the domain mapping listed
- Status should change to show DNS records

### Step 5: Get DNS Records

Once created, click on your domain mapping (`slnent.com`) in the list:

1. You'll see a details page
2. Look for a section called **"DNS records"** or **"Resource records"**
3. You'll see records like:
   - **Name**: `slnent.com.` or `@`
   - **Type**: `CNAME` or `A`
   - **Value**: Something like `ghs.googlehosted.com.` or an IP address

**Copy these DNS records** - you'll need them in the next step!

### Step 6: Add DNS Records at Your Domain Registrar

Go to where you registered `slnent.com` (GoDaddy, Namecheap, Google Domains, etc.):

1. **Log into your domain registrar**
2. Navigate to **DNS Management** or **DNS Settings**
3. Find the section for DNS records (A, CNAME, etc.)
4. **Add a new record**:
   - **Type**: Use the type from Step 5 (usually `CNAME`)
   - **Name/Host**: 
     - If the record shows `slnent.com.`, use `@` or `slnent.com`
     - If it shows `@`, use `@` or leave blank (depends on your registrar)
   - **Value/Target**: The value from Step 5 (e.g., `ghs.googlehosted.com.`)
   - **TTL**: `3600` or use default (1 hour)
5. **Save** the DNS record

### Step 7: Wait for DNS Propagation

- **Time**: 5-60 minutes (usually 15-30 minutes)
- You can check if DNS has propagated by running in terminal:
  ```bash
  dig slnent.com +short
  ```
  Or use an online tool: [whatsmydns.net](https://www.whatsmydns.net/#CNAME/slnent.com)

### Step 8: SSL Certificate (Automatic)

✅ **No action needed!**
- Google automatically provisions SSL certificates
- This happens **after** DNS is propagated
- Takes 10-60 minutes after DNS is active
- You'll get HTTPS automatically

### Step 9: Verify It's Working

1. **Check status in GCP Console**:
   - Go back to Cloud Run → Domain mappings
   - Click on `slnent.com`
   - Status should show **"ACTIVE"** (not "Pending")
   
2. **Test in browser**:
   - Go to: `https://slnent.com/health`
   - Should see: `{"status":"healthy","timestamp":"..."}`

---

## Visual Guide - Console Locations

### Finding Domain Mappings:
```
Google Cloud Console
├── Navigation Menu (☰)
    ├── Serverless
        └── Cloud Run
            └── Domain mappings ← Click here
```

### Domain Mapping Details Page Shows:
- **Status**: ACTIVE / PENDING / NONE
- **DNS records**: The records you need to add
- **Service**: instagram-bot
- **Region**: us-central1

---

## Common DNS Record Formats

### If you see a CNAME record:
```
Name:   @ (or slnent.com)
Type:   CNAME
Value:  ghs.googlehosted.com.
TTL:    3600
```

### If you see an A record:
```
Name:   @ (or slnent.com)
Type:   A
Value:  [IP address like 216.239.32.21]
TTL:    3600
```

**Note**: Different registrars have different interfaces:
- Some use `@` for root domain
- Some require `slnent.com` explicitly
- Some leave the name field blank for root domain

---

## Troubleshooting

### Status shows "PENDING"
- **DNS not propagated yet**: Wait 15-60 minutes
- **DNS record incorrect**: Double-check the record at your registrar
- **Wrong record type**: Make sure you used CNAME if it said CNAME

### Status shows "NONE"
- DNS records haven't been added yet
- Or DNS hasn't propagated (wait longer)

### Can't find "Domain mappings" in menu
- Make sure you're viewing **Cloud Run** (not Cloud Functions)
- Try refreshing the page
- Check you're in the correct project

### SSL certificate not working
- DNS must be fully propagated first (check with `dig`)
- Wait up to 60 minutes for SSL provisioning
- HTTPS will work automatically once DNS is active

---

## After Setup is Complete

Once status shows **"ACTIVE"**, your webhooks will be:

- **Instagram**: `https://slnent.com/webhook`
- **WhatsApp**: `https://slnent.com/whatsapp-webhook`
- **Health Check**: `https://slnent.com/health`

### Update Webhook URLs

Don't forget to update your webhook URLs in:
1. **Facebook Developers Console** (Instagram webhook)
2. **Meta Business Suite** (WhatsApp webhook)

---

## Quick Status Check Commands (Optional)

If you want to check status from terminal:

```bash
# List all domain mappings
gcloud beta run domain-mappings list --platform managed

# Describe specific domain
gcloud beta run domain-mappings describe slnent.com \
  --region us-central1 \
  --platform managed

# Check DNS propagation
dig slnent.com +short
```

---

## Summary Checklist

- [ ] Open Google Cloud Console
- [ ] Navigate to Cloud Run → Domain mappings
- [ ] Create domain mapping for `slnent.com`
- [ ] Copy DNS records from the console
- [ ] Add DNS records at your domain registrar
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Wait for SSL certificate (10-60 minutes after DNS)
- [ ] Verify status shows "ACTIVE"
- [ ] Test `https://slnent.com/health`
- [ ] Update webhook URLs with new domain

**Total hands-on time: ~10 minutes**  
**Total wait time: 15-120 minutes**  
**Most of it is automatic - you just need to wait!**

