#!/bin/bash

# Test Instagram API Message Sending
# Copy this command and run it locally to test

curl --location --request POST 'https://graph.instagram.com/v23.0/17841472601427095/messages' \
--header 'Authorization: Bearer IGAASnIBgEdr9BZAFJMNmZAiWnZA2SmQ0VWxmc3NQYXZAfVlRpX3VoWnZApNjItbUJtWlJNc1kyWV9YRU9aZAVVlUjhnYWtfbnBXSXVwbGxHdUIybDdOVms2ZAFoxaS1QYVBlSzNwd0s5Vkx5MVZA6WjBwVG1QSTFHZA2hvOENBWmtudHgtTQZDZD' \
--header 'Content-Type: application/json' \
--header 'Accept-Language: en-US,en;q=0.9' \
--data '{"recipient":{"id":"758608673285458"},"message":{"text":"🔍 Processing your reel for fact-checking... Please wait while I analyze the caption, video and audio content."}}'

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "If this works locally but fails in GCP, it's a network issue"
echo "If this fails locally too, check your Instagram token/credentials"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

