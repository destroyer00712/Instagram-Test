const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const cron = require('node-cron');
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
const whatsappWebhookHandler = require('./modules/whatsappWebhook');
const messageHandler = require('./modules/messageHandler');
const instagramAPI = require('./modules/instagramAPI');
const vectorCache = require('./modules/vectorCache');

// Routes
app.get('/', (req, res) => {
  res.send('Instagram & WhatsApp Chatbot is running!');
});

// Instagram Webhook verification endpoint
app.get('/webhook', webhookHandler.verify);

// Instagram Webhook message receiving endpoint
app.post('/webhook', webhookHandler.receive);

// WhatsApp Webhook verification endpoint
app.get('/whatsapp-webhook', whatsappWebhookHandler.verify);

// WhatsApp Webhook message receiving endpoint
app.post('/whatsapp-webhook', whatsappWebhookHandler.receive);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize vector cache
const initializeVectorCache = async () => {
  try {
    console.log('🔧 Initializing vector cache...');
    await vectorCache.initializeQdrant();
    console.log('✅ Vector cache initialized successfully');
  } catch (error) {
    console.log('⚠️ Vector cache initialization failed:', error.message);
    console.log('⚠️ Fact-checking will work without caching');
  }
};

// Setup vector cache cleanup cron job
const setupCleanupJob = () => {
  // Run cleanup every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('[CLEANUP] Starting vector cache cleanup...');
      const result = await vectorCache.cleanupExpiredEntries();
      console.log(`[CLEANUP] Cleanup complete: ${result.deleted}/${result.total} entries removed`);
    } catch (error) {
      console.error('[CLEANUP] Error during cleanup:', error.message);
    }
  });
  
  console.log('✅ Vector cache cleanup job scheduled (every 30 minutes)');
};

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Instagram & WhatsApp Chatbot server running on port ${PORT}`);
  console.log(`📡 Instagram Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`📱 WhatsApp Webhook URL: http://localhost:${PORT}/whatsapp-webhook`);
  
  // Initialize vector cache and setup cleanup
  await initializeVectorCache();
  setupCleanupJob();
});

module.exports = app; 