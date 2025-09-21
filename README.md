# 🤖 Instagram Fact-Checking Chatbot

An intelligent Instagram chatbot that automatically fact-checks videos, images, and text messages using advanced AI technology. Built for the hackathon to combat misinformation on social media.

## 🎥 Demo Video

**Watch the demo in action:**

<video src="assets/demo/demo.mp4" controls width="800">
  Your browser does not support the video tag.
</video>

*[Demo shows the bot receiving an Instagram message, processing a video, and providing fact-checked results]*

## 🚀 Try It Live!

**Follow us on Instagram and send a message to test the bot:**

1. **Follow**: [@chatloom.in](https://instagram.com/chatloom.in) on Instagram
2. **Send a message** with any video, image, or text you want fact-checked
3. **Get instant results** with sources and credibility analysis

## ✨ Features

### 🎯 **Multi-Modal Fact-Checking**
- **Video Analysis**: Extracts frames, transcribes audio, analyzes visual content
- **Image Verification**: Reverse image search, metadata analysis, source verification
- **Text Fact-Checking**: Claims verification against reliable sources
- **Audio Processing**: Speech-to-text with context analysis

### 🧠 **Advanced AI Technology**
- **Google Gemini AI**: Latest 2.0 Flash model for superior accuracy
- **Automatic Fallback**: Seamless model switching for reliability
- **Conspiracy Detection**: Identifies misinformation patterns
- **Source Verification**: Cross-references multiple reliable sources

### 🔍 **Comprehensive Analysis**
- **Credibility Scoring**: 0-100% confidence ratings
- **Source Attribution**: Links to original sources and fact-checkers
- **Timeline Analysis**: Checks for outdated or time-sensitive information
- **Bias Detection**: Identifies potential political or commercial bias

### 🛡️ **Security & Privacy**
- **Webhook Verification**: Secure Instagram webhook integration
- **Rate Limiting**: Prevents API abuse and quota exhaustion
- **Environment Protection**: All sensitive data properly secured
- **Error Handling**: Graceful degradation and comprehensive logging

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Instagram     │    │   Our Server     │    │   AI Services   │
│   User          │───▶│   (Node.js)      │───▶│   (Gemini AI)   │
│   Sends Media   │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Fact-Checking  │
                       │   & Sources      │
                       └──────────────────┘
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **AI/ML**: Google Gemini AI (2.0 Flash, 1.5 Pro)
- **Media Processing**: FFmpeg, Puppeteer
- **APIs**: Instagram Graph API, Google Custom Search
- **Storage**: File system (temp processing)
- **Deployment**: PM2, Nginx

## 📋 Prerequisites

- Node.js 16+ 
- Instagram Business Account
- Google AI Studio API Key
- Google Custom Search API Key
- Webhook-capable server (ngrok for development)

## 🚀 Quick Setup

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/instagram-chatbot.git
cd instagram-chatbot
npm install
```

### 2. Environment Setup
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### 3. Required Environment Variables
```bash
# Instagram Configuration
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCOUNT_ID=your_account_id

# Webhook Security
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
WEBHOOK_SECRET=your_webhook_secret

# AI Services
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CUSTOM_SEARCH_API_KEY=your_search_api_key
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 4. Test Your Setup
```bash
# Test Gemini AI connection
npm run test:gemini

# Test fact-checking functionality
npm run test:claims

# Start the server
npm start
```

## 📱 Instagram Setup

### 1. Create Instagram App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app → "Business" type
3. Add "Instagram Basic Display" product
4. Get your App ID and App Secret

### 2. Configure Webhooks
1. Add webhook URL: `https://yourdomain.com/webhook`
2. Subscribe to: `messages`, `messaging_postbacks`
3. Set verify token (same as `WEBHOOK_VERIFY_TOKEN`)

### 3. Get Access Token
1. Use Instagram Graph API Explorer
2. Generate long-lived access token
3. Add to your `.env` file

## 🧪 Testing

```bash
# Test individual components
npm run test:env      # Environment variables
npm run test:api      # API connections
npm run test:claims   # Fact-checking logic
npm run test:gemini   # AI model connectivity

# Test with real Instagram message
npm run test:webhook  # Webhook simulation
```

## 📊 API Endpoints

- `GET /webhook` - Webhook verification
- `POST /webhook` - Receive Instagram messages
- `GET /health` - Health check
- `GET /status` - System status

## 🔧 Configuration

### Model Settings
```javascript
// In modules/factChecker.js
const MODEL_CONFIG = {
  TRANSCRIPTION: 'gemini-1.5-pro',      // Primary model
  FALLBACK: 'gemini-2.0-flash-exp',    // Fallback model
  FACT_CHECK: 'gemini-1.5-pro',        // Fact-checking model
  CONSPIRACY: 'gemini-1.5-pro'         // Conspiracy detection
};
```

### Rate Limiting
```javascript
// In modules/instagramAPI.js
const rateLimit = {
  maxRequests: 60,        // Requests per minute
  windowMs: 60 * 1000     // 1 minute window
};
```

## 🚀 Deployment

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Start with ecosystem file
pm2 start ecosystem.config.js

# Monitor
pm2 monit
```

### Using Docker
```bash
# Build image
docker build -t instagram-chatbot .

# Run container
docker run -d --env-file .env -p 3000:3000 instagram-chatbot
```

## 📈 Monitoring

### Logs
```bash
# View logs
pm2 logs instagram-chatbot

# Real-time monitoring
pm2 monit
```

### Health Checks
- `GET /health` - Basic health check
- `GET /status` - Detailed system status
- Automatic error reporting and recovery

## 🛡️ Security Features

- **Webhook Verification**: HMAC signature validation
- **Rate Limiting**: Prevents abuse and quota exhaustion
- **Environment Variables**: All secrets properly secured
- **Input Validation**: Sanitizes all user inputs
- **Error Handling**: No sensitive data in error messages

## 🔍 Fact-Checking Process

1. **Receive Message**: Instagram webhook triggers processing
2. **Media Extraction**: Download and analyze video/image content
3. **Content Analysis**: 
   - Extract frames from videos
   - Transcribe audio content
   - Analyze visual elements
4. **AI Processing**: 
   - Run through Gemini AI models
   - Detect conspiracy theories
   - Verify factual claims
5. **Source Verification**: 
   - Search reliable fact-checking sources
   - Cross-reference information
   - Check publication dates
6. **Response Generation**: 
   - Compile results with confidence scores
   - Include source links
   - Send formatted response

## 📚 Documentation

- [API Setup Guide](GEMINI_API_KEY_SETUP.md)
- [Google Search Implementation](GOOGLE_CUSTOM_SEARCH_IMPLEMENTATION.md)
- [System Architecture](SYSTEM_ARCHITECTURE.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Enhanced Features](ENHANCED_FEATURES.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/instagram-chatbot/issues)
- **Documentation**: Check the `/docs` folder
- **Contact**: [@chatloom.in](https://instagram.com/chatloom.in) on Instagram

## 🏆 Hackathon Project

This project was built for the hackathon to address the critical issue of misinformation on social media platforms. The bot provides:

- **Instant fact-checking** for Instagram users
- **Multi-modal analysis** (text, images, videos)
- **Reliable source attribution**
- **Easy-to-understand results**

**Try it now**: Follow [@chatloom.in](https://instagram.com/chatloom.in) and send any message to get started!

---

*Built with ❤️ for a more informed social media experience*