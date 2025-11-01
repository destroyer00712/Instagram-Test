const crypto = require('crypto');
const messageHandler = require('./messageHandler');

// DEDUPLICATION: Track processed messages to avoid duplicates/echoes
const processedMessages = new Set();
const processedWebhooks = new Set(); // Track webhook request hashes
const MESSAGE_CACHE_SIZE = 1000; // Keep last 1000 message IDs
const WEBHOOK_CACHE_SIZE = 500; // Keep last 500 webhook hashes
const MESSAGE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

// Clean up old caches periodically to prevent memory leaks
setInterval(() => {
  if (processedMessages.size > MESSAGE_CACHE_SIZE) {
    console.log(`🧹 Cleaning message cache (size: ${processedMessages.size})`);
    processedMessages.clear();
  }
  if (processedWebhooks.size > WEBHOOK_CACHE_SIZE) {
    console.log(`🧹 Cleaning webhook cache (size: ${processedWebhooks.size})`);
    processedWebhooks.clear();
  }
}, 60000); // Clean every minute

/**
 * Webhook verification for Instagram
 * This is called when Facebook/Instagram verifies your webhook endpoint
 */
const verify = (req, res) => {
  console.log(`📡 [${new Date().toISOString()}] Webhook verification request received`);
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
  console.log('  - Expected Token:', process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN);
  
  // Get the verify token from environment (support both naming conventions)
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN;
  
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook verified successfully!');
      console.log('📤 Sending challenge response:', challenge);
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed - invalid token');
      console.log('  - Expected:', verifyToken);
      console.log('  - Received:', token);
      console.log('  - Match:', token === verifyToken);
      res.status(403).send('Forbidden');
    }
  } else {
    console.log('❌ Webhook verification failed - missing parameters');
    console.log('  - Mode present:', !!mode);
    console.log('  - Token present:', !!token);
    res.status(400).send('Bad Request');
  }
};

/**
 * Webhook message receiver
 * This handles incoming Instagram messages
 */
const receive = async (req, res) => {
  const body = req.body;
  const timestamp = new Date().toISOString();
  
  // Create a hash of the webhook payload to detect duplicate webhook calls
  const webhookHash = crypto.createHash('md5').update(JSON.stringify(body)).digest('hex');
  
  // Check for duplicate webhook calls at the request level
  if (processedWebhooks.has(webhookHash)) {
    console.log(`🔄 DUPLICATE WEBHOOK IGNORED: ${webhookHash}`);
    res.status(200).send('EVENT_RECEIVED');
    return;
  }
  
  processedWebhooks.add(webhookHash);
  console.log(`📨 [${timestamp}] New webhook: ${webhookHash.substring(0, 8)}... from ${req.headers['user-agent'] || 'unknown'}`);
  
  // Check if this is a page subscription
  if (body.object === 'instagram') {
    console.log('✅ Valid Instagram webhook object detected');
    console.log('📊 Webhook Statistics:');
    console.log('  - Number of entries:', body.entry ? body.entry.length : 0);
    
    // Signature verification removed for debugging
    
    // Iterate over each entry - there may be multiple if batched
    for (const [entryIndex, entry] of body.entry.entries()) {
      console.log(`🔄 Processing entry ${entryIndex + 1}: ${entry.messaging ? entry.messaging.length : 0} messages`);
      
      if (entry.messaging) {
        for (const [messageIndex, messageEvent] of entry.messaging.entries()) {
          // Reduced logging - let handleMessage do the detailed logging for valid messages
          await handleMessage(messageEvent);
        }
      } else {
        console.log('  - No messaging events found in entry');
      }
    }
    
    // Return a '200 OK' response to acknowledge receipt
    console.log('✅ Sending EVENT_RECEIVED response');
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    console.log('❌ Invalid webhook object. Expected: instagram, Received:', body.object);
    console.log('📦 Full body:', JSON.stringify(body, null, 2));
    res.status(404).send('Not Found');
  }
};

/**
 * Verify webhook signature
 */
const verifySignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    console.log('❌ No signature found in request headers');
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  const signatureHash = `sha256=${expectedSignature}`;
  
  if (signature !== signatureHash) {
    console.log('❌ Signature mismatch');
    return false;
  }
  
  return true;
};

/**
 * Handle incoming message
 */
const handleMessage = async (messageEvent) => {
  const senderId = messageEvent.sender ? messageEvent.sender.id : 'unknown';
  const recipientId = messageEvent.recipient ? messageEvent.recipient.id : 'unknown';
  const timestamp = messageEvent.timestamp || Date.now();
  const messageId = messageEvent.message?.mid || `${senderId}_${timestamp}`;
  
  // 🚫 EARLY FILTERING: Skip echo messages immediately (messages sent by the bot itself)
  if (messageEvent.message && messageEvent.message.is_echo) {
    console.log(`🔄 Skipping echo message: ${messageId}`);
    return;
  }
  
  // Skip messages from the bot account itself
  if (senderId === process.env.INSTAGRAM_ACCOUNT_ID) {
    console.log(`🔄 Skipping message from bot account: ${senderId}`);
    return;
  }
  
  // 🚫 DEDUPLICATION: Check if we've already processed this message
  if (processedMessages.has(messageId)) {
    console.log(`🔄 DUPLICATE MESSAGE IGNORED: ${messageId}`);
    return; // Skip processing - no verbose logging for duplicates
  }
  
  // Add message ID to processed set
  processedMessages.add(messageId);
  console.log(`✅ NEW MESSAGE: ${messageId} from ${senderId}`);
  
  // Clean up old entries if cache is getting too large
  if (processedMessages.size > MESSAGE_CACHE_SIZE) {
    console.log(`🧹 Message cache full, clearing oldest entries`);
    processedMessages.clear();
    processedMessages.add(messageId); // Re-add current message
  }
  
  // Only log detailed message info for actual new messages that will be processed
  console.log(`🔍 [${new Date().toISOString()}] Processing Message:`);
  console.log(`  - From: ${senderId} | To: ${recipientId}`);
  console.log(`  - Timestamp: ${timestamp} | Date: ${new Date(timestamp).toISOString()}`);
  console.log(`  - Message ID: ${messageId}`);
  
  // Check if message contains text
  if (messageEvent.message && messageEvent.message.text) {
    const messageText = messageEvent.message.text;
    console.log(`💬 Text Message:`);
    console.log(`  - Content: "${messageText}"`);
    console.log(`  - Length: ${messageText.length} characters`);
    console.log(`  - Message ID: ${messageEvent.message.mid || 'N/A'}`);
    
    // Process the message
    console.log('🔄 Forwarding to message handler...');
    try {
      await messageHandler.handleMessage(senderId, { text: messageText });
      console.log('✅ Message handler completed successfully');
    } catch (error) {
      console.error('❌ Error in message handler:', error);
    }
  } else if (messageEvent.message && messageEvent.message.attachments) {
    console.log('📎 Attachment Message:');
    console.log(`  - Number of attachments: ${messageEvent.message.attachments.length}`);
    console.log(`  - Attachments:`, JSON.stringify(messageEvent.message.attachments, null, 2));
    console.log(`  - Message ID: ${messageEvent.message.mid || 'N/A'}`);
    
    console.log('🔄 Forwarding to attachment handler...');
    try {
      await messageHandler.handleMessage(senderId, { attachments: messageEvent.message.attachments });
      console.log('✅ Attachment handler completed successfully');
    } catch (error) {
      console.error('❌ Error in attachment handler:', error);
    }
  } else if (messageEvent.postback) {
    console.log('🔘 Postback Event:');
    console.log(`  - Payload: ${messageEvent.postback.payload}`);
    console.log(`  - Title: ${messageEvent.postback.title || 'N/A'}`);
  } else if (messageEvent.delivery) {
    console.log('✅ Delivery Confirmation:');
    console.log(`  - Message IDs: ${messageEvent.delivery.mids ? messageEvent.delivery.mids.join(', ') : 'N/A'}`);
    console.log(`  - Watermark: ${messageEvent.delivery.watermark}`);
  } else if (messageEvent.read) {
    console.log('👁️ Read Receipt:');
    console.log(`  - Watermark: ${messageEvent.read.watermark}`);
  } else {
    console.log('❓ Unknown message type received');
    console.log('📦 Full message event:', JSON.stringify(messageEvent, null, 2));
  }
};

module.exports = {
  verify,
  receive
}; 