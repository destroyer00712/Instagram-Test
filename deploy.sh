#!/bin/bash

# Instagram Chatbot Deployment Script
echo "🚀 Deploying Instagram Chatbot..."

# Variables
APP_NAME="instagram-chatbot"
VPS_USER="your-username"
VPS_HOST="your-vps-ip"
VPS_PATH="/path/to/your/app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create deployment archive
print_status "Creating deployment archive..."
tar -czf instagram-chatbot.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=logs \
    --exclude=instagram-chatbot.tar.gz \
    . || { print_error "Failed to create archive"; exit 1; }

# Upload to VPS
print_status "Uploading to VPS..."
scp instagram-chatbot.tar.gz $VPS_USER@$VPS_HOST:$VPS_PATH/ || { print_error "Failed to upload"; exit 1; }

# Deploy on VPS
print_status "Deploying on VPS..."
ssh $VPS_USER@$VPS_HOST << EOF
    cd $VPS_PATH
    
    # Backup existing deployment
    if [ -f server.js ]; then
        print_status "Backing up existing deployment..."
        tar -czf backup-\$(date +%Y%m%d_%H%M%S).tar.gz server.js modules package.json || true
    fi
    
    # Extract new deployment
    print_status "Extracting new deployment..."
    tar -xzf instagram-chatbot.tar.gz || { print_error "Failed to extract"; exit 1; }
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm install --production || { print_error "Failed to install dependencies"; exit 1; }
    
    # Create logs directory
    mkdir -p logs
    
    # Restart PM2 app
    print_status "Restarting application..."
    pm2 restart $APP_NAME || pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Clean up
    rm -f instagram-chatbot.tar.gz
    
    print_status "Deployment completed successfully!"
EOF

# Clean up local archive
rm -f instagram-chatbot.tar.gz

print_status "Deployment script completed!"
print_status "Check your app status with: ssh $VPS_USER@$VPS_HOST 'pm2 status'"
print_status "View logs with: ssh $VPS_USER@$VPS_HOST 'pm2 logs $APP_NAME'" 