# Update Instagram Access Token - Quick Guide

## Option 1: Run the Script Locally

If you have `gcloud` CLI installed locally:

```bash
./update-instagram-token.sh "YOUR_NEW_ACCESS_TOKEN_HERE"
```

**Example:**
```bash
./update-instagram-token.sh "IGAAIg8bVtJbVBZAE5kV1JucFpVVVotbkNwSC1VM2ktWEZAXbU5nMWRRMGlrX0NzOHE1WWp0SUpreEo1T1Y5WUpOc3RjX3pod3c0SWNpbkFzQjFLUW5wZAEdra1B6dzRmdzlLSml3YXNGaG1INU1NSTF5anFtZAzI5VVpEbE9YVERLRQZDZD"
```

## Option 2: Run in Google Cloud Shell

1. **Open Google Cloud Shell**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Click the Cloud Shell icon (top right) or press `Ctrl+` (Windows/Linux) / `Cmd+` (Mac)

2. **Upload the script**:
   ```bash
   # In Cloud Shell, create the file
   nano update-instagram-token.sh
   # Paste the script content, save with Ctrl+X, then Y, then Enter
   
   # Make it executable
   chmod +x update-instagram-token.sh
   ```

3. **Run the script**:
   ```bash
   ./update-instagram-token.sh "YOUR_NEW_ACCESS_TOKEN_HERE"
   ```

## Option 3: Manual Steps (If Script Doesn't Work)

### Step 1: Update Secret in Secret Manager

```bash
echo -n "YOUR_NEW_ACCESS_TOKEN_HERE" | gcloud secrets versions add instagram-access-token --data-file=-
```

### Step 2: Update Cloud Run Service

```bash
gcloud run services update instagram-bot \
    --platform managed \
    --region us-central1 \
    --set-secrets="INSTAGRAM_ACCESS_TOKEN=instagram-access-token:latest"
```

### Step 3: Verify Service is Running

```bash
# Check service status
gcloud run services describe instagram-bot --region us-central1

# View recent logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50
```

## What the Script Does

1. ✅ **Validates** the access token is provided
2. ✅ **Updates** the secret in Google Secret Manager
3. ✅ **Updates** Cloud Run service to use the new secret (forces restart)
4. ✅ **Verifies** service status and URL
5. ✅ **Provides** next steps and testing commands

## Testing Your New Token

After updating, test with this cURL command:

```bash
curl --location --request POST 'https://graph.instagram.com/v23.0/17841472601427095/messages' \
  --header 'Authorization: Bearer YOUR_NEW_ACCESS_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "recipient": {
      "id": "758608673285458"
    },
    "message": {
      "text": "🧪 Test - Token updated!"
    }
  }'
```

**Success Response:**
```json
{
  "recipient_id": "758608673285458",
  "message_id": "some_message_id"
}
```

## Troubleshooting

### "Permission denied" error
```bash
# Make sure script is executable
chmod +x update-instagram-token.sh
```

### "No default project set"
```bash
# Set your GCP project
gcloud config set project YOUR_PROJECT_ID
```

### "Secret not found"
```bash
# List all secrets to verify name
gcloud secrets list

# If secret doesn't exist, create it first:
echo -n "YOUR_TOKEN" | gcloud secrets create instagram-access-token --data-file=-
```

### Service not updating
```bash
# Force a new revision by updating env vars
gcloud run services update instagram-bot \
    --region us-central1 \
    --update-env-vars="FORCE_RESTART=$(date +%s)"
```

## Get Your New Access Token

1. Go to [Facebook Developer Console](https://developers.facebook.com/apps/)
2. Select your app
3. Go to **Instagram** → **Basic Display** or **Messaging**
4. Generate a new **Long-Lived Access Token**
5. Copy the token and use it in the script

## Quick Reference

**Service Details:**
- Service Name: `instagram-bot`
- Region: `us-central1`
- Secret Name: `instagram-access-token`

**Useful Commands:**
```bash
# View logs
gcloud run services logs read instagram-bot --region us-central1 --limit 50

# Follow logs in real-time
gcloud run services logs read instagram-bot --region us-central1 --follow

# Check service status
gcloud run services describe instagram-bot --region us-central1

# Get service URL
gcloud run services describe instagram-bot --region us-central1 --format="value(status.url)"
```

