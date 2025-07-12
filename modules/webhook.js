const crypto = require('crypto');
const messageHandler = require('./messageHandler');

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
  console.log('  - Expected Token:', process.env.WEBHOOK_VERIFY_TOKEN);
  
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully!');
      console.log('📤 Sending challenge response:', challenge);
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed - invalid token');
      console.log('  - Expected:', process.env.WEBHOOK_VERIFY_TOKEN);
      console.log('  - Received:', token);
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
const receive = (req, res) => {
  console.log(`📨 [${new Date().toISOString()}] Webhook message received`);
  console.log('🔍 Request Details:');
  console.log('  - Method:', req.method);
  console.log('  - URL:', req.url);
  console.log('  - Headers:', JSON.stringify(req.headers, null, 2));
  console.log('  - User-Agent:', req.headers['user-agent']);
  console.log('  - Content-Type:', req.headers['content-type']);
  
  const body = req.body;
  console.log('📦 Request Body:', JSON.stringify(body, null, 2));
  
  // Check if this is a page subscription
  if (body.object === 'instagram') {
    console.log('✅ Valid Instagram webhook object detected');
    console.log('📊 Webhook Statistics:');
    console.log('  - Number of entries:', body.entry ? body.entry.length : 0);
    
    // Signature verification removed for debugging
    
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach((entry, entryIndex) => {
      console.log(`🔄 Processing entry ${entryIndex + 1}:`, JSON.stringify(entry, null, 2));
      
      if (entry.messaging) {
        console.log(`  - Found ${entry.messaging.length} messaging events`);
        entry.messaging.forEach((messageEvent, messageIndex) => {
          console.log(`📋 Processing message event ${messageIndex + 1}:`, JSON.stringify(messageEvent, null, 2));
          handleMessage(messageEvent);
        });
      } else {
        console.log('  - No messaging events found in entry');
      }
    });
    
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
const handleMessage = (messageEvent) => {
  console.log(`🔍 [${new Date().toISOString()}] Message Event Details:`, JSON.stringify(messageEvent, null, 2));
  
  const senderId = messageEvent.sender ? messageEvent.sender.id : 'unknown';
  const recipientId = messageEvent.recipient ? messageEvent.recipient.id : 'unknown';
  const timestamp = messageEvent.timestamp || Date.now();
  
  console.log(`👤 Message Processing:`);
  console.log(`  - From: ${senderId}`);
  console.log(`  - To: ${recipientId}`);
  console.log(`  - Timestamp: ${timestamp}`);
  console.log(`  - Date: ${new Date(timestamp).toISOString()}`);
  
  // Skip echo messages (messages sent by the bot itself)
  if (messageEvent.message && messageEvent.message.is_echo) {
    console.log('🔄 Skipping echo message (bot\'s own message)');
    return;
  }
  
  // Skip messages from the bot account itself
  if (senderId === process.env.INSTAGRAM_ACCOUNT_ID) {
    console.log('🔄 Skipping message from bot account itself');
    return;
  }
  
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
      messageHandler.processMessage(senderId, messageText, timestamp);
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
      messageHandler.processAttachment(senderId, messageEvent.message.attachments, timestamp);
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