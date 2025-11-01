#!/bin/bash

# Test Instagram Credentials with cURL
# Replace these values with your actual credentials

# Your Instagram Account ID (from webhook logs or Facebook Developer Console)
INSTAGRAM_ACCOUNT_ID="17841472601427095"

# Your Instagram Access Token
INSTAGRAM_ACCESS_TOKEN="YOUR_ACCESS_TOKEN_HERE"

# Test recipient ID (use the sender ID from your webhook test, or get it from previous messages)
RECIPIENT_ID="758608673285458"

echo "Testing Instagram Graph API credentials..."
echo "=========================================="

curl --location --request POST "https://graph.instagram.com/v23.0/${INSTAGRAM_ACCOUNT_ID}/messages" \
  --header "Authorization: Bearer ${INSTAGRAM_ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  --header "Accept-Language: en-US,en;q=0.9" \
  --data '{
    "recipient": {
      "id": "'"${RECIPIENT_ID}"'"
    },
    "message": {
      "text": "🧪 Test message - If you see this, your credentials are working!"
    }
  }'

echo ""
echo ""
echo "=========================================="
echo "Test complete!"

