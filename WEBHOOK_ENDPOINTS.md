# Webhook Endpoints Reference

## Cloud Run Service URL
```
https://instagram-bot-vaddtuhfba-uc.a.run.app
```

---

## 📱 Instagram Webhook

### Endpoint
```
https://instagram-bot-vaddtuhfba-uc.a.run.app/webhook
```

### Configuration
- **Callback URL**: `https://instagram-bot-vaddtuhfba-uc.a.run.app/webhook`
- **Verify Token**: `TestDMBot_verify_token_123`
- **Method**: 
  - `GET` - For webhook verification (Meta/Facebook verification)
  - `POST` - For receiving messages and events

### Verification Test
```bash
curl -X GET "https://instagram-bot-vaddtuhfba-uc.a.run.app/webhook?hub.mode=subscribe&hub.verify_token=TestDMBot_verify_token_123&hub.challenge=test"
```

### Where to Configure
1. Go to [Facebook Developers Console](https://developers.facebook.com/)
2. Select your Instagram App
3. Go to **Settings** → **Basic** → **Instagram Product**
4. Configure **Webhooks**:
   - Callback URL: `https://instagram-bot-vaddtuhfba-uc.a.run.app/webhook`
   - Verify Token: `TestDMBot_verify_token_123`
5. Subscribe to events:
   - ✅ `messages`
   - ✅ `messaging_postbacks`

---

## 💬 WhatsApp Webhook

### Endpoint
```
https://instagram-bot-vaddtuhfba-uc.a.run.app/whatsapp-webhook
```

### Configuration
- **Callback URL**: `https://instagram-bot-vaddtuhfba-uc.a.run.app/whatsapp-webhook`
- **Verify Token**: `de0d2928-d41d-4170-ad82-fe220b6ac8fc`
- **Method**: 
  - `GET` - For webhook verification (Meta verification)
  - `POST` - For receiving messages and status updates

### Verification Test
```bash
curl -X GET "https://instagram-bot-vaddtuhfba-uc.a.run.app/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=de0d2928-d41d-4170-ad82-fe220b6ac8fc&hub.challenge=test"
```

### Where to Configure
1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **WhatsApp** → **Configuration** → **Webhooks**
3. Configure:
   - Callback URL: `https://instagram-bot-vaddtuhfba-uc.a.run.app/whatsapp-webhook`
   - Verify Token: `de0d2928-d41d-4170-ad82-fe220b6ac8fc`
4. Subscribe to fields:
   - ✅ `messages`
   - ✅ `message_status`

---

## 🏥 Health Check Endpoint

### Endpoint
```
https://instagram-bot-vaddtuhfba-uc.a.run.app/health
```

### Test
```bash
curl https://instagram-bot-vaddtuhfba-uc.a.run.app/health
```

### Expected Response
```json
{"status":"healthy","timestamp":"2025-10-31T12:56:07.156Z"}
```

---

## 🔐 Verify Tokens Summary

| Service | Verify Token |
|---------|-------------|
| **Instagram** | `TestDMBot_verify_token_123` |
| **WhatsApp** | `de0d2928-d41d-4170-ad82-fe220b6ac8fc` |

---

## 📝 Quick Setup Checklist

- [ ] Configure Instagram webhook in Facebook Developers Console
- [ ] Configure WhatsApp webhook in Meta Business Suite
- [ ] Test webhook verification (GET requests)
- [ ] Subscribe to required events/message fields
- [ ] Send a test message to verify POST requests work
- [ ] Monitor logs: `gcloud run services logs read instagram-bot --region us-central1 --follow`

---

## 🐛 Troubleshooting

### Webhook Verification Fails
1. Check that the verify token matches exactly (case-sensitive)
2. Ensure the webhook URL is publicly accessible (Cloud Run is already public)
3. Check Cloud Run logs: `gcloud run services logs read instagram-bot --region us-central1 --limit 50`

### Webhook Not Receiving Messages
1. Verify webhook is subscribed to the correct events
2. Check Cloud Run service is running: `gcloud run services describe instagram-bot --region us-central1`
3. Test health endpoint to ensure service is responsive
4. Check application logs for errors

### SSL/Certificate Issues
- Cloud Run automatically provides SSL certificates
- The URLs use HTTPS by default
- No additional SSL configuration needed

---

## 📞 Support

If you need to update webhook URLs or verify tokens:
1. Update secrets in Secret Manager: `gcloud secrets versions add SECRET_NAME --data-file=-`
2. Redeploy Cloud Run service to pick up changes

