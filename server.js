const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

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