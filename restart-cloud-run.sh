#!/bin/bash

# Restart Cloud Run service by triggering a new revision
# This will reload all environment variables

set -e

echo "🔄 Restarting Cloud Run service..."
echo ""

# Trigger a new revision by updating with current config
# This effectively restarts the service
gcloud run services update instagram-bot \
    --platform managed \
    --region us-central1 \
    --no-traffic \
    --quiet

# Wait a moment
sleep 2

# Set traffic back to the new revision
gcloud run services update-traffic instagram-bot \
    --platform managed \
    --region us-central1 \
    --to-latest \
    --quiet

echo ""
echo "✅ Cloud Run service restarted!"
echo ""
echo "📝 The service should now have all environment variables loaded."
echo "   Check the logs to verify INSTAGRAM_VERIFY_TOKEN is set correctly."

