# Troubleshooting Guide 🔧

This guide helps you resolve common issues when setting up and running your Instagram chatbot.

## Quick Checklist ✅

Before diving into specific issues, check these basics:

- [ ] Node.js version 14+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] Environment variables properly configured
- [ ] Instagram Business Account connected to Facebook Page
- [ ] Facebook App properly configured
- [ ] Webhook URL publicly accessible
- [ ] Internet connection stable

## Common Issues & Solutions

### 1. Webhook Verification Failed ❌

**Symptoms:**
- Facebook webhook verification returns "Forbidden" or "Bad Request"
- Webhook setup fails in Facebook Developer Console

**Solutions:**

1. **Check Verify Token:**
   ```bash
   # Ensure WEBHOOK_VERIFY_TOKEN in .env matches Facebook configuration
   echo $WEBHOOK_VERIFY_TOKEN
   ```

2. **Verify Webhook URL:**
   ```bash
   # Test webhook endpoint manually
   curl "https://your-domain.com/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=YOUR_TOKEN"
   ```

3. **Check Server Logs:**
   ```bash
   # Look for webhook verification logs
   npm run dev
   # Check console for webhook verification messages
   ```

### 2. Messages Not Being Received 📨

**Symptoms:**
- Bot doesn't respond to Instagram DMs
- No webhook POST requests received

**Solutions:**

1. **Verify Webhook Subscriptions:**
   - Go to Facebook Developer Console → Webhooks
   - Ensure these fields are subscribed:
     - `messages`
     - `messaging_postbacks`
     - `messaging_optins`

2. **Check Instagram Account Type:**
   - Must be Instagram Business Account
   - Must be connected to Facebook Page
   - Page must be published (not draft)

3. **Test Webhook Endpoint:**
   ```bash
   # Test POST endpoint
   curl -X POST https://your-domain.com/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

### 3. Access Token Issues 🔑

**Symptoms:**
- "Invalid Access Token" errors
- API calls return authentication errors

**Solutions:**

1. **Generate New Access Token:**
   - Go to Facebook Developer Console
   - Instagram → Basic Display → User Token Generator
   - Generate new token and update `.env`

2. **Check Token Permissions:**
   ```bash
   # Test token validity
   curl "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"
   ```

3. **Verify App Permissions:**
   - Ensure app has `instagram_basic` permission
   - For production, submit app for review

### 4. Rate Limiting Errors ⚠️

**Symptoms:**
- "Rate limit exceeded" errors
- API calls being rejected

**Solutions:**

1. **Adjust Rate Limits:**
   ```javascript
   // In modules/instagramAPI.js
   const rateLimiter = {
     maxRequests: 30, // Reduce from 60
     windowMs: 60 * 1000
   };
   ```

2. **Implement Message Queue:**
   ```javascript
   // Add to your code for high-volume bots
   const messageQueue = [];
   
   setInterval(() => {
     if (messageQueue.length > 0) {
       const message = messageQueue.shift();
       sendMessage(message.recipient, message.text);
     }
   }, 2000); // Send every 2 seconds
   ```

### 5. SSL/HTTPS Issues 🔒

**Symptoms:**
- Webhook verification fails
- "Invalid URL" errors from Facebook

**Solutions:**

1. **For Local Testing (ngrok):**
   ```bash
   # Install ngrok
   npm install -g ngrok
   
   # Start ngrok
   ngrok http 3000
   
   # Use HTTPS URL in Facebook webhook configuration
   ```

2. **For Production:**
   - Use proper SSL certificate
   - Ensure HTTPS is properly configured
   - Test SSL configuration: [SSL Labs](https://www.ssllabs.com/ssltest/)

### 6. Environment Variables Not Loading 🔧

**Symptoms:**
- "undefined" values in console
- Configuration errors

**Solutions:**

1. **Check .env File:**
   ```bash
   # Verify .env file exists and has correct format
   ls -la .env
   cat .env
   ```

2. **Verify dotenv Loading:**
   ```javascript
   // At top of server.js
   require('dotenv').config();
   console.log('Environment loaded:', process.env.NODE_ENV);
   ```

3. **Check File Permissions:**
   ```bash
   # Ensure .env file is readable
   chmod 644 .env
   ```

### 7. Facebook App Not Approved 📋

**Symptoms:**
- Bot works in development but not production
- Limited to developer accounts only

**Solutions:**

1. **Submit for App Review:**
   - Go to Facebook Developer Console → App Review
   - Request `instagram_basic` and `instagram_manage_messages` permissions
   - Provide detailed use case description

2. **Test Mode Configuration:**
   ```javascript
   // Add test mode check
   if (process.env.NODE_ENV === 'development') {
     console.log('Running in test mode');
   }
   ```

### 8. CORS Issues 🌐

**Symptoms:**
- Browser console shows CORS errors
- API calls blocked by browser

**Solutions:**

1. **Add CORS Headers:**
   ```javascript
   // In server.js
   app.use((req, res, next) => {
     res.header('Access-Control-Allow-Origin', '*');
     res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
     next();
   });
   ```

2. **Use CORS Middleware:**
   ```bash
   npm install cors
   ```
   ```javascript
   const cors = require('cors');
   app.use(cors());
   ```

### 9. Server Not Starting 🚫

**Symptoms:**
- "Port already in use" errors
- Server crashes on startup

**Solutions:**

1. **Check Port Usage:**
   ```bash
   # Find process using port 3000
   lsof -i :3000
   
   # Kill process if needed
   kill -9 <PID>
   ```

2. **Try Different Port:**
   ```bash
   # In .env file
   PORT=3001
   ```

3. **Check Dependencies:**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

### 10. Message Handler Errors 💬

**Symptoms:**
- Bot receives messages but doesn't respond
- Console shows processing errors

**Solutions:**

1. **Check Message Structure:**
   ```javascript
   // Add debugging to messageHandler.js
   console.log('Message event:', JSON.stringify(messageEvent, null, 2));
   ```

2. **Verify API Calls:**
   ```javascript
   // Test API call manually
   const response = await instagramAPI.sendMessage(senderId, 'Test message');
   console.log('API response:', response);
   ```

## Debugging Tips 🔍

### Enable Verbose Logging

```javascript
// In server.js
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
  });
}
```

### Test API Endpoints

```bash
# Test webhook verification
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=YOUR_TOKEN"

# Test health endpoint
curl "http://localhost:3000/health"
```

### Monitor Network Traffic

```bash
# Use ngrok to inspect webhook traffic
ngrok http 3000 --log=stdout
```

## Production Checklist 🚀

Before deploying to production:

- [ ] Environment variables properly set
- [ ] SSL certificate configured
- [ ] Rate limiting appropriately configured
- [ ] Error handling tested
- [ ] Webhook URL updated in Facebook
- [ ] App submitted for review (if needed)
- [ ] Monitoring and logging configured
- [ ] Backup and recovery plan in place

## Getting Help 🆘

If you're still experiencing issues:

1. **Check Server Logs:**
   ```bash
   # View recent logs
   tail -f logs/app.log
   
   # Or check console output
   npm run dev
   ```

2. **Test Individual Components:**
   - Test webhook endpoint manually
   - Verify Instagram API calls
   - Check Facebook app configuration

3. **Community Resources:**
   - Facebook Developer Community
   - Stack Overflow (tag: instagram-graph-api)
   - GitHub Issues

4. **Professional Support:**
   - Consider hiring a developer
   - Facebook Developer Support (paid)

## Frequently Asked Questions ❓

**Q: Do I need a verified Facebook Page?**
A: No, but your page must be published (not draft) and connected to your Instagram Business Account.

**Q: Can I use a personal Instagram account?**
A: No, you must use an Instagram Business or Creator account connected to a Facebook Page.

**Q: How long does Facebook app review take?**
A: Usually 3-7 business days, but can take longer depending on complexity.

**Q: Is there a limit to how many messages I can send?**
A: Yes, Instagram has rate limits. This bot includes built-in rate limiting to prevent issues.

**Q: Can I use this for multiple Instagram accounts?**
A: You'll need separate Facebook apps for each Instagram account.

---

**Need more help?** Check the main README.md or create an issue on GitHub. 