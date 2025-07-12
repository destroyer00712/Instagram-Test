# Instagram Chatbot 🤖

A comprehensive Instagram chatbot built with Node.js and Express that uses the Instagram Graph API v23.0 to receive and respond to direct messages.

## Features ✨

- 🔄 **Real-time messaging** - Receives and responds to Instagram DMs via webhooks
- 🧠 **Smart conversation flow** - Keyword recognition and contextual responses
- 👋 **Welcome messages** - Greets new users and provides helpful menus
- 📱 **Quick replies** - Interactive buttons for easy navigation
- ⚡ **Rate limiting** - Built-in protection against API limits
- 🔒 **Secure webhooks** - Signature verification for security
- 📊 **Conversation state** - Tracks user interactions and preferences
- 🎯 **Keyword matching** - Responds to various user intents
- 💬 **Typing indicators** - Shows when bot is processing messages
- 🔧 **Error handling** - Robust error management and logging

## Prerequisites 📋

Before getting started, you'll need:

1. **Node.js** (v14 or higher)
2. **Facebook Developer Account** - [Sign up here](https://developers.facebook.com/)
3. **Instagram Business Account** - Connected to a Facebook Page
4. **Webhook endpoint** - Public URL for receiving messages (use ngrok for local testing)

## Installation 🚀

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd instagram-chatbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp config.template .env
   ```
   
   Edit the `.env` file with your actual values:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Instagram Graph API Configuration (v23.0)
   INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token_here
   INSTAGRAM_APP_ID=your_app_id_here
   INSTAGRAM_APP_SECRET=your_app_secret_here
   INSTAGRAM_ACCOUNT_ID=your_instagram_account_id_here
   
   # Webhook Configuration
   WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
   WEBHOOK_SECRET=your_webhook_secret_here
   
   # Instagram Account
   INSTAGRAM_ACCOUNT_ID=your_instagram_account_id_here
   ```

4. **Start the server:**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

## Facebook Developer Console Setup 🔧

### Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App" → "Business" → "Next"
3. Fill in your app details:
   - App Name: "Your Instagram Chatbot"
   - Contact Email: your-email@example.com
4. Click "Create App"

### Step 2: Add Instagram Basic Display

1. In your app dashboard, click "Add Product"
2. Find "Instagram Basic Display" and click "Set Up"
3. Click "Create New App" if prompted

### Step 3: Configure Instagram Messaging

1. Go to Instagram → Basic Display → User Token Generator
2. Add your Instagram account
3. Generate access token and copy it to your `.env` file

### Step 4: Set Up Webhooks

1. In your app, go to "Webhooks" in the left menu
2. Click "New Subscription"
3. Choose "Instagram"
4. Enter your webhook URL: `https://your-domain.com/webhook`
5. Enter your verify token (same as in `.env`)
6. Select these subscription fields:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`
7. Click "Verify and Save"

### Step 5: App Review (For Production)

For production use, you'll need to submit your app for review:

1. Go to "App Review" in your Facebook app
2. Request permissions for:
   - `instagram_basic`
   - `instagram_manage_messages`
3. Provide detailed information about your bot's purpose
4. Submit for review

## Usage 💬

### Starting the Bot

```bash
npm start
```

Your bot will be running at `http://localhost:3000`

### Available Commands

Users can interact with your bot using these keywords:

- **help** - Show available commands
- **menu** - Display interactive menu
- **about** - Learn about your business
- **contact** - Get contact information
- **hours** - See business hours
- **services** - View available services
- **hello/hi/hey** - Greeting responses
- **thank you** - Acknowledgment responses

### Testing Locally

1. **Install ngrok** (for local webhook testing):
   ```bash
   npm install -g ngrok
   ```

2. **Start ngrok**:
   ```bash
   ngrok http 3000
   ```

3. **Use the ngrok URL** in your Facebook webhook configuration:
   ```
   https://your-ngrok-id.ngrok.io/webhook
   ```

## API Endpoints 🔗

### Webhook Verification
- **GET** `/webhook` - Verifies webhook with Facebook
- **POST** `/webhook` - Receives Instagram messages

### Health Check
- **GET** `/health` - Returns server health status

### Root
- **GET** `/` - Basic server status

## Configuration ⚙️

### Customizing Responses

Edit the `botResponses` object in `modules/messageHandler.js`:

```javascript
const botResponses = {
  greeting: [
    "Hello! 👋 Welcome to our Instagram chatbot!",
    "Hi there! 😊 How can I help you today?"
  ],
  help: "Here's what I can help you with...",
  // Add more responses...
};
```

### Rate Limiting

Adjust rate limits in `modules/instagramAPI.js`:

```javascript
const rateLimiter = {
  maxRequests: 60, // requests per minute
  windowMs: 60 * 1000 // 1 minute window
};
```

### Adding New Commands

Add new keyword recognition in `generateResponse()` function:

```javascript
if (text.includes('new_command')) {
  return {
    type: 'text',
    text: 'Your response here'
  };
}
```

## Project Structure 📁

```
instagram-chatbot/
├── modules/
│   ├── webhook.js          # Webhook handling
│   ├── instagramAPI.js     # Instagram API integration
│   └── messageHandler.js   # Conversation logic
├── server.js               # Main server file
├── package.json           # Dependencies
├── config.template        # Environment variables template
└── README.md             # Documentation
```

## Error Handling 🚨

The bot includes comprehensive error handling:

- **Rate limiting** - Prevents API quota exceeded
- **Webhook verification** - Ensures secure message delivery
- **API errors** - Gracefully handles Instagram API failures
- **Invalid messages** - Responds appropriately to unknown inputs
- **Network errors** - Retries and fallback responses

## Security 🔒

- **Webhook signature verification** - Validates message authenticity
- **Environment variables** - Keeps sensitive data secure
- **Rate limiting** - Prevents abuse
- **Input validation** - Sanitizes user inputs

## Common Issues & Solutions 🔧

### Webhook Not Receiving Messages

1. **Check webhook URL** - Ensure it's publicly accessible
2. **Verify tokens** - Confirm WEBHOOK_VERIFY_TOKEN matches
3. **Check permissions** - Ensure proper Instagram API permissions
4. **Review logs** - Check server logs for errors

### Rate Limiting Issues

1. **Adjust limits** - Modify `RATE_LIMIT_REQUESTS_PER_MINUTE`
2. **Implement queuing** - Add message queue for high volume
3. **Monitor usage** - Track API call frequency

### Authentication Errors

1. **Refresh tokens** - Instagram tokens expire periodically
2. **Check permissions** - Verify app has necessary permissions
3. **Update app** - Ensure app is approved for production use

## Deployment 🚀

### Heroku Deployment

1. **Install Heroku CLI**
2. **Create Heroku app**:
   ```bash
   heroku create your-bot-name
   ```
3. **Set environment variables**:
   ```bash
   heroku config:set INSTAGRAM_ACCESS_TOKEN=your_token
   heroku config:set WEBHOOK_VERIFY_TOKEN=your_verify_token
   # ... set all other variables
   ```
4. **Deploy**:
   ```bash
   git push heroku main
   ```

### AWS/DigitalOcean Deployment

1. **Set up server** with Node.js
2. **Clone repository**
3. **Install dependencies**: `npm install`
4. **Set environment variables**
5. **Use PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "instagram-bot"
   ```

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Support 💬

For support and questions:

- **GitHub Issues** - Report bugs and request features
- **Email** - your-email@example.com
- **Documentation** - Check this README and inline comments

## Changelog 📝

### Version 1.0.0
- Initial release
- Basic messaging functionality
- Webhook integration
- Conversation state management
- Error handling and rate limiting

---

**Built with ❤️ using Node.js and Instagram Graph API** 