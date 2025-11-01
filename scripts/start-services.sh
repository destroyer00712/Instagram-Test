#!/bin/bash
# Script to start GCP services when needed
# This restarts Qdrant VM and optionally recreates VPC Connector

set -e

export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"
PROJECT_ID=$(gcloud config get-value project)
ZONE="us-central1-a"
REGION="us-central1"

echo "▶️  Starting GCP services..."
echo ""

# Start Qdrant VM
echo "Starting Qdrant VM..."
gcloud compute instances start qdrant-vm --zone=$ZONE --quiet
echo "✅ Qdrant VM started"

# Wait for VM to be ready
echo "Waiting for VM to be ready (30 seconds)..."
sleep 30

# Verify Qdrant is running
echo "Checking Qdrant container status..."
gcloud compute ssh qdrant-vm --zone=$ZONE --command="sudo docker ps | grep qdrant || (echo 'Qdrant not running, starting...' && sudo docker start qdrant || sudo docker run -d --name qdrant --restart unless-stopped -p 6333:6333 -v /tmp/qdrant-storage:/qdrant/storage qdrant/qdrant:latest)" --quiet || echo "⚠️  Could not verify Qdrant (SSH may need setup)"

# Check if VPC Connector exists, create if needed
if ! gcloud compute networks vpc-access connectors describe qdrant-connector --region=$REGION --quiet 2>/dev/null; then
    echo ""
    echo "VPC Connector not found, creating..."
    gcloud compute networks vpc-access connectors create qdrant-connector \
        --region=$REGION \
        --subnet=vpc-connector-subnet \
        --subnet-project=$PROJECT_ID \
        --min-instances=2 \
        --max-instances=3 \
        --machine-type=e2-micro \
        --quiet
    echo "✅ VPC Connector created"
    
    # Update Cloud Run to use VPC connector
    echo "Updating Cloud Run service to use VPC connector..."
    gcloud run services update instagram-bot \
        --vpc-connector=qdrant-connector \
        --vpc-egress=all \
        --region=$REGION \
        --platform=managed \
        --quiet
    echo "✅ Cloud Run updated"
else
    echo "✅ VPC Connector already exists"
fi

echo ""
echo "✅ All services started!"
echo ""
echo "Cloud Run URL:"
gcloud run services describe instagram-bot --region=$REGION --platform=managed --format="value(status.url)"
echo ""
echo "💡 Cloud Run will automatically scale up when it receives requests"

