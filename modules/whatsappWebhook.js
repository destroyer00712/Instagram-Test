const crypto = require('crypto');
const whatsappMessageHandler = require('./whatsappMessageHandler');

// DEDUPLICATION: Track processed messages to avoid duplicates/echoes
const processedMessages = new Set();
const processedWebhooks = new Set(); // Track webhook request hashes
const MESSAGE_CACHE_SIZE = 1000; // Keep last 1000 message IDs
const WEBHOOK_CACHE_SIZE = 500; // Keep last 500 webhook hashes
const MESSAGE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

// Clean up old caches periodically to prevent memory leaks
setInterval(() => {
  if (processedMessages.size > MESSAGE_CACHE_SIZE) {
    console.log(`🧹 Cleaning WhatsApp message cache (size: ${processedMessages.size})`);
    processedMessages.clear();
  }
  if (processedWebhooks.size > WEBHOOK_CACHE_SIZE) {
    console.log(`🧹 Cleaning WhatsApp webhook cache (size: ${processedWebhooks.size})`);
    processedWebhooks.clear();
  }
}, 60000); // Clean every minute

/**
 * Webhook verification for WhatsApp
 * This is called when Meta verifies your WhatsApp webhook endpoint
 */
const verify = (req, res) => {
  console.log(`📡 [${new Date().toISOString()}] WhatsApp webhook verification request received`);
  console.log('🔍 Request Details:');
  console.log('  - Method:', req.method);
  console.log('  - URL:', req.url);
  console.log('  - Headers:', JSON.stringify(req.headers, null, 2));
  console.log('  - Query Parameters:', JSON.stringify(req.query, null, 2));
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('🔐 Verification Parameters:');
  console.log('  - Mode:', mode);
  console.log('  - Token:', token);
  console.log('  - Challenge:', challenge);
  console.log('  - Expected Token:', process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || token === 'de0d2928-d41d-4170-ad82-fe220b6ac8fc') {
      console.log('✅ WhatsApp webhook verified successfully!');
      console.log('📤 Sending challenge response:', challenge);
      res.status(200).send(challenge);
    } else {
      console.log('❌ WhatsApp webhook verification failed - invalid token');
      console.log('  - Expected:', process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
      console.log('  - Received:', token);
      res.status(403).send('Forbidden');
    }
  } else {
    console.log('❌ WhatsApp webhook verification failed - missing parameters');
    console.log('  - Mode present:', !!mode);
    console.log('  - Token present:', !!token);
    res.status(400).send('Bad Request');
  }
};

/**
 * Webhook message receiver
 * This handles incoming WhatsApp messages
 */
const receive = async (req, res) => {
  const body = req.body;
  const timestamp = new Date().toISOString();
  
  // Create a hash of the webhook payload to detect duplicate webhook calls
  const webhookHash = crypto.createHash('md5').update(JSON.stringify(body)).digest('hex');
  
  // Check for duplicate webhook calls at the request level
  if (processedWebhooks.has(webhookHash)) {
    console.log(`🔄 DUPLICATE WHATSAPP WEBHOOK IGNORED: ${webhookHash}`);
    res.status(200).send('EVENT_RECEIVED');
    return;
  }
  
  processedWebhooks.add(webhookHash);
  console.log(`📨 [${timestamp}] New WhatsApp webhook: ${webhookHash.substring(0, 8)}... from ${req.headers['user-agent'] || 'unknown'}`);
  
  // Check if this is a WhatsApp webhook
  if (body.object === 'whatsapp_business_account') {
    console.log('✅ Valid WhatsApp webhook object detected');
    console.log('📊 Webhook Statistics:');
    console.log('  - Number of entries:', body.entry ? body.entry.length : 0);
    
    // Iterate over each entry - there may be multiple if batched
    for (const [entryIndex, entry] of body.entry.entries()) {
      console.log(`🔄 Processing entry ${entryIndex + 1}: ${entry.changes ? entry.changes.length : 0} changes`);
      
      if (entry.changes) {
        for (const [changeIndex, change] of entry.changes.entries()) {
          console.log(`🔄 Processing change ${changeIndex + 1}: ${change.field}`);
          
          if (change.field === 'messages' && change.value) {
            await handleWhatsAppMessages(change.value);
          }
        }
      } else {
        console.log('  - No changes found in entry');
      }
    }
    
    // Return a '200 OK' response to acknowledge receipt
    console.log('✅ Sending EVENT_RECEIVED response');
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return a '404 Not Found' if event is not from WhatsApp
    console.log('❌ Invalid webhook object. Expected: whatsapp_business_account, Received:', body.object);
    console.log('📦 Full body:', JSON.stringify(body, null, 2));
    res.status(404).send('Not Found');
  }
};

/**
 * Verify webhook signature for WhatsApp
 */
const verifySignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    console.log('❌ No signature found in WhatsApp request headers');
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  const signatureHash = `sha256=${expectedSignature}`;
  
  if (signature !== signatureHash) {
    console.log('❌ WhatsApp signature mismatch');
    return false;
  }
  
  return true;
};

/**
 * Handle incoming WhatsApp messages
 */
const handleWhatsAppMessages = async (value) => {
  console.log(`📱 Processing WhatsApp messages from ${value.from || 'unknown'}`);
  
  // Process messages
  if (value.messages) {
    for (const [messageIndex, message] of value.messages.entries()) {
      await handleWhatsAppMessage(message);
    }
  }
  
  // Process status updates (delivery receipts, read receipts, etc.)
  if (value.statuses) {
    for (const [statusIndex, status] of value.statuses.entries()) {
      console.log(`📊 Status update: ${status.status} for message ${status.id}`);
    }
  }
};

/**
 * Handle individual WhatsApp message
 */
const handleWhatsAppMessage = async (message) => {
  const messageId = message.id;
  const fromNumber = message.from;
  const timestamp = message.timestamp;
  const type = message.type;
  
  // 🚫 DEDUPLICATION: Check if we've already processed this message
  if (processedMessages.has(messageId)) {
    console.log(`🔄 DUPLICATE WHATSAPP MESSAGE IGNORED: ${messageId}`);
    return; // Skip processing - no verbose logging for duplicates
  }
  
  // Add message ID to processed set
  processedMessages.add(messageId);
  console.log(`✅ NEW WHATSAPP MESSAGE: ${messageId} from ${fromNumber}`);
  
  // Clean up old entries if cache is getting too large
  if (processedMessages.size > MESSAGE_CACHE_SIZE) {
    console.log(`🧹 WhatsApp message cache full, clearing oldest entries`);
    processedMessages.clear();
    processedMessages.add(messageId); // Re-add current message
  }
  
  // Only log detailed message info for actual new messages that will be processed
  console.log(`🔍 [${new Date().toISOString()}] Processing WhatsApp Message:`);
  console.log(`  - From: ${fromNumber}`);
  console.log(`  - Timestamp: ${timestamp} | Date: ${new Date(timestamp * 1000).toISOString()}`);
  console.log(`  - Message ID: ${messageId}`);
  console.log(`  - Type: ${type}`);
  
  try {
    // Handle different message types
    switch (type) {
      case 'text':
        await handleTextMessage(fromNumber, message);
        break;
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        await handleMediaMessage(fromNumber, message);
        break;
      case 'location':
        await handleLocationMessage(fromNumber, message);
        break;
      case 'contacts':
        await handleContactsMessage(fromNumber, message);
        break;
      default:
        console.log(`❓ Unknown WhatsApp message type: ${type}`);
        console.log('📦 Full message:', JSON.stringify(message, null, 2));
    }
  } catch (error) {
    console.error(`❌ Error handling WhatsApp message ${messageId}:`, error);
  }
};

/**
 * Handle text messages
 */
const handleTextMessage = async (fromNumber, message) => {
  const messageText = message.text.body;
  console.log(`💬 WhatsApp Text Message:`);
  console.log(`  - Content: "${messageText}"`);
  console.log(`  - Length: ${messageText.length} characters`);
  
  // Process the message through the WhatsApp message handler
  console.log('🔄 Forwarding to WhatsApp message handler...');
  try {
    await whatsappMessageHandler.handleMessage(fromNumber, { text: messageText });
    console.log('✅ WhatsApp message handler completed successfully');
  } catch (error) {
    console.error('❌ Error in WhatsApp message handler:', error);
  }
};

/**
 * Handle media messages (images, videos, audio, documents)
 */
const handleMediaMessage = async (fromNumber, message) => {
  const mediaType = message.type;
  const mediaId = message[mediaType].id;
  const mediaCaption = message[mediaType].caption || '';
  
  console.log(`📎 WhatsApp ${mediaType.toUpperCase()} Message:`);
  console.log(`  - Media ID: ${mediaId}`);
  console.log(`  - Caption: "${mediaCaption}"`);
  
  // Create attachment object similar to Instagram format
  const attachment = {
    type: `whatsapp_${mediaType}`,
    id: mediaId,
    caption: mediaCaption,
    mime_type: message[mediaType].mime_type || 'unknown'
  };
  
  console.log('🔄 Forwarding to WhatsApp attachment handler...');
  try {
    await whatsappMessageHandler.handleMessage(fromNumber, { attachments: [attachment] });
    console.log('✅ WhatsApp attachment handler completed successfully');
  } catch (error) {
    console.error('❌ Error in WhatsApp attachment handler:', error);
  }
};

/**
 * Handle location messages
 */
const handleLocationMessage = async (fromNumber, message) => {
  const location = message.location;
  console.log(`📍 WhatsApp Location Message:`);
  console.log(`  - Latitude: ${location.latitude}`);
  console.log(`  - Longitude: ${location.longitude}`);
  console.log(`  - Name: ${location.name || 'N/A'}`);
  console.log(`  - Address: ${location.address || 'N/A'}`);
  
  // For now, just acknowledge location messages
  console.log('📍 Location message received - not processed for fact-checking');
};

/**
 * Handle contacts messages
 */
const handleContactsMessage = async (fromNumber, message) => {
  const contacts = message.contacts;
  console.log(`👥 WhatsApp Contacts Message:`);
  console.log(`  - Number of contacts: ${contacts.length}`);
  
  contacts.forEach((contact, index) => {
    console.log(`  - Contact ${index + 1}: ${contact.name?.formatted_name || 'N/A'}`);
  });
  
  // For now, just acknowledge contacts messages
  console.log('👥 Contacts message received - not processed for fact-checking');
};

module.exports = {
  verify,
  receive,
  verifySignature
};
