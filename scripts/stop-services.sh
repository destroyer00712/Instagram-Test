#!/bin/bash
# Script to stop GCP services when not in use
# This saves ~$24/month on Qdrant VM compute costs

set -e

export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"
PROJECT_ID=$(gcloud config get-value project)
ZONE="us-central1-a"
REGION="us-central1"

echo "🛑 Stopping GCP services to save costs..."
echo ""

# Stop Qdrant VM (saves ~$24/month in compute costs)
echo "Stopping Qdrant VM..."
gcloud compute instances stop qdrant-vm --zone=$ZONE --quiet
echo "✅ Qdrant VM stopped"

# Optionally delete VPC Connector (saves ~$12-18/month)
# Uncomment the lines below if you want to delete it too
# echo ""
# echo "Deleting VPC Connector..."
# gcloud compute networks vpc-access connectors delete qdrant-connector --region=$REGION --quiet
# echo "✅ VPC Connector deleted"

echo ""
echo "💰 Cost savings:"
echo "  - Qdrant VM compute: ~\$24/month (disk storage ~\$3.40/month still charged)"
echo "  - Total when stopped: ~\$3.40/month (vs ~\$27.67/month when running)"
echo ""
echo "⚠️  Note: Cloud Run will scale to zero automatically when idle (no requests)"
echo ""
echo "To restart services, run: ./scripts/start-services.sh"

