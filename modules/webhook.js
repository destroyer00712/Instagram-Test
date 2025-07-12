const crypto = require('crypto');
const messageHandler = require('./messageHandler');

/**
 * Webhook verification for Instagram
 * This is called when Facebook/Instagram verifies your webhook endpoint
 */
const verify = (req, res) => {
  console.log('📡 Webhook verification request received');
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully!');
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed - invalid token');
      res.status(403).send('Forbidden');
    }
  } else {
    console.log('❌ Webhook verification failed - missing parameters');
    res.status(400).send('Bad Request');
  }
};

/**
 * Webhook message receiver
 * This handles incoming Instagram messages
 */
const receive = (req, res) => {
  console.log('📨 Webhook message received');
  
  const body = req.body;
  
  // Check if this is a page subscription
  if (body.object === 'instagram') {
    // Verify webhook signature
    if (!verifySignature(req)) {
      console.log('❌ Invalid webhook signature');
      return res.status(401).send('Unauthorized');
    }
    
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(messageEvent => {
          console.log('📋 Processing message event:', JSON.stringify(messageEvent, null, 2));
          handleMessage(messageEvent);
        });
      }
    });
    
    // Return a '200 OK' response to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
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
  const senderId = messageEvent.sender.id;
  const recipientId = messageEvent.recipient.id;
  const timestamp = messageEvent.timestamp;
  
  console.log(`👤 Message from ${senderId} to ${recipientId} at ${timestamp}`);
  
  // Check if message contains text
  if (messageEvent.message && messageEvent.message.text) {
    const messageText = messageEvent.message.text;
    console.log(`💬 Message text: ${messageText}`);
    
    // Process the message
    messageHandler.processMessage(senderId, messageText, timestamp);
  } else if (messageEvent.message && messageEvent.message.attachments) {
    console.log('📎 Message contains attachments');
    messageHandler.processAttachment(senderId, messageEvent.message.attachments, timestamp);
  } else {
    console.log('❓ Unknown message type received');
  }
};

module.exports = {
  verify,
  receive
}; 