const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

// Debug environment variables on startup
console.log('🔧 Environment Variables Debug:');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 PORT:', process.env.PORT);
console.log('🔧 GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('🔧 GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined');
console.log('🔧 GEMINI_API_KEY preview:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 15) + '...' + process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 15) : 'undefined');
console.log('🔧 GOOGLE_FACTCHECK_API_KEY exists:', !!process.env.GOOGLE_FACTCHECK_API_KEY);
console.log('🔧 INSTAGRAM_ACCESS_TOKEN exists:', !!process.env.INSTAGRAM_ACCESS_TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Import modules
const webhookHandler = require('./modules/webhook');
const messageHandler = require('./modules/messageHandler');
const instagramAPI = require('./modules/instagramAPI');

// Routes
app.get('/', (req, res) => {
  res.send('Instagram Chatbot is running!');
});

// Webhook verification endpoint
app.get('/webhook', webhookHandler.verify);

// Webhook message receiving endpoint
app.post('/webhook', webhookHandler.receive);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Instagram Chatbot server running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
});

module.exports = app; 