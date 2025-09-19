# Instagram Fact-Checker Bot 🔍🤖

An intelligent Instagram chatbot built with Node.js and Express that uses the Instagram Graph API v23.0 to receive and respond to direct messages. **NEW: Now features AI-powered fact-checking of Instagram reels!**

## Features ✨

### 🆕 NEW: AI Fact-Checking Features
- 🎥 **Instagram Reel Processing** - Automatically downloads and processes shared reels
- 🎤 **AI Transcription** - Uses Google Gemini AI to transcribe video audio
- 🧠 **Claim Extraction** - Intelligently identifies factual claims from content
- 🔍 **Fact Verification** - Queries Google's Fact Check Tools API
- 📊 **Detailed Results** - Provides verdicts with confidence levels and sources
- 💾 **Memory Storage** - Remembers fact-check history for each user

### 🤖 Core Chatbot Features
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
5. **🆕 FFmpeg** - For video processing (install via `brew install ffmpeg` on macOS)
6. **🆕 Google AI API Key** - For Gemini AI transcription
7. **🆕 Google Fact Check API Key** - For fact verification

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

3. **🆕 Run setup script:**
   ```bash
   npm run setup
   ```

4. **Set up environment variables:**
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
   
   # 🆕 AI Fact-Checking APIs
   GEMINI_API_KEY=your_gemini_api_key_here
   GOOGLE_FACTCHECK_API_KEY=your_google_factcheck_api_key_here
   
   # 🆕 File Storage
   TEMP_VIDEO_DIR=./temp/videos/
   TEMP_AUDIO_DIR=./temp/audio/
   ```

5. **Start the server:**
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

#### 🆕 Fact-Checking Commands
- **Share Instagram Reel** - Bot automatically fact-checks claims in the video
- **history** - View your previous fact-check results
- **factcheck** - Show fact-check help

#### Standard Bot Commands
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
│   ├── messageHandler.js   # Conversation logic
│   └── factChecker.js      # 🆕 AI fact-checking functionality
├── temp/                   # 🆕 Temporary file storage
│   ├── videos/            # Downloaded Instagram reels
│   └── audio/             # Extracted audio files
├── server.js               # Main server file
├── setup.js                # 🆕 Setup and validation script
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

### Version 2.0.0 (Current)
- 🆕 **AI-Powered Fact-Checking** - Automatically processes Instagram reels
- 🆕 **Google Gemini Integration** - Transcribes video audio using AI
- 🆕 **Fact Verification** - Uses Google Fact Check Tools API
- 🆕 **Claim Analysis** - Intelligently extracts verifiable claims
- 🆕 **Source Attribution** - Provides credible fact-check sources
- 🆕 **Memory System** - Stores and recalls fact-check history
- 🆕 **Video Processing** - Downloads and processes video content
- Improved error handling and logging
- Enhanced conversation management

### Version 1.0.0
- Initial release
- Basic messaging functionality
- Webhook integration
- Conversation state management
- Error handling and rate limiting

## 🔍 How Fact-Checking Works

1. **User shares Instagram reel** → Bot detects video attachment
2. **Video download** → Downloads video from Instagram's CDN
3. **Audio extraction** → Uses FFmpeg to extract audio track
4. **AI transcription** → Google Gemini transcribes speech to text
5. **Claim identification** → AI analyzes content for factual claims
6. **Fact verification** → Searches Google Fact Check Tools API
7. **Result analysis** → Evaluates sources and generates verdict
8. **User response** → Sends detailed fact-check results
9. **Memory storage** → Saves results for future reference

## 📊 Fact-Check Result Example

```
📊 Fact-Check Results

🎯 Claim: "Charlie Kirk was fatally shot by an assassin"

⭐ Verdict: False (High confidence)

📝 Summary: Based on 3 fact-check sources, this claim appears to be false or misleading. Latest review by AP News rated it as "This is false".

🔗 Sources:
1. AP News - This is false
   https://apnews.com/article/fact-check-charlie-kirk...
2. Snopes - False
   https://snopes.com/fact-check/charlie-kirk...
3. PolitiFact - Pants on Fire
   https://politifact.com/factchecks/...

💬 You can ask me about this fact-check anytime!
```

---

**Built with ❤️ using Node.js, Instagram Graph API, Google AI, and Fact Check Tools** 