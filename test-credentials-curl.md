# Test Instagram Credentials with cURL

## Quick Test cURL Command

Replace the placeholders with your actual values:

```bash
curl --location --request POST 'https://graph.instagram.com/v23.0/17841472601427095/messages' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
  --header 'Content-Type: application/json' \
  --header 'Accept-Language: en-US,en;q=0.9' \
  --data '{
    "recipient": {
      "id": "758608673285458"
    },
    "message": {
      "text": "🧪 Test message - Your credentials are working!"
    }
  }'
```

## Postman Setup

1. **Method**: POST
2. **URL**: `https://graph.instagram.com/v23.0/17841472601427095/messages`
3. **Headers**:
   - `Authorization`: `Bearer YOUR_ACCESS_TOKEN_HERE`
   - `Content-Type`: `application/json`
   - `Accept-Language`: `en-US,en;q=0.9`

4. **Body** (raw JSON):
```json
{
  "recipient": {
    "id": "758608673285458"
  },
  "message": {
    "text": "🧪 Test message - Your credentials are working!"
  }
}
```

## What to Check

✅ **Success Response (200 OK)**:
```json
{
  "recipient_id": "758608673285458",
  "message_id": "some_message_id"
}
```

❌ **Common Errors**:
- **401 Unauthorized**: Invalid or expired access token
- **403 Forbidden**: Token doesn't have messaging permissions
- **400 Bad Request**: Invalid recipient ID or message format
- **ETIMEDOUT**: Network connectivity issue (will retry automatically in app)

## Get Your Credentials

1. **Instagram Account ID**: 
   - From your logs: `17841472601427095`
   - Or Facebook Developer Console → Your App → Instagram → Basic Display

2. **Access Token**: 
   - Check your environment variables: `INSTAGRAM_ACCESS_TOKEN`
   - Or Facebook Developer Console → Your App → Instagram → Access Tokens

3. **Recipient ID**: 
   - Use the sender ID from webhook logs (e.g., `758608673285458`)
   - This is the Instagram user ID who sent you a message

## Alternative: Test with a Different Recipient

If you want to test sending to yourself, you can get your own Instagram User ID:
```bash
curl --location --request GET 'https://graph.instagram.com/me?fields=id,username' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE'
```

