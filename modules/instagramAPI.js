const axios = require('axios');

// Instagram Graph API base URL
const BASE_URL = 'https://graph.instagram.com/v23.0';

// Instagram message limits
const MESSAGE_CHAR_LIMIT = 1000; // Instagram's character limit per message
const MESSAGE_SPLIT_BUFFER = 50; // Leave buffer for clean splits

/**
 * Generate cURL command for debugging
 */
const generateCurl = (method, url, headers, data) => {
  let curl = `curl --location --request ${method.toUpperCase()} '${url}'`;
  
  // Add headers
  if (headers) {
    Object.keys(headers).forEach(key => {
      curl += ` \\\n  --header '${key}: ${headers[key]}'`;
    });
  }
  
  // Add data for POST requests
  if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
    curl += ` \\\n  --data '${JSON.stringify(data)}'`;
  }
  
  return curl;
};

// Rate limiting
const rateLimiter = {
  requests: [],
  maxRequests: process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || 60,
  windowMs: 60 * 1000, // 1 minute
  
  canMakeRequest() {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if we're under the limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    return false;
  }
};

/**
 * Split long message into Instagram-compliant chunks
 */
const splitMessage = (message, maxLength = MESSAGE_CHAR_LIMIT - MESSAGE_SPLIT_BUFFER) => {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks = [];
  let currentChunk = '';
  
  // Split by sentences first (periods, exclamation marks, question marks)
  const sentences = message.split(/([.!?]\s+)/);
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // If adding this sentence would exceed the limit, finalize current chunk
    if (currentChunk.length + sentence.length > maxLength && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // If any chunk is still too long, split by words
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxLength) {
      finalChunks.push(chunk);
    } else {
      // Split by words as fallback
      const words = chunk.split(' ');
      let wordChunk = '';
      
      for (const word of words) {
        if (wordChunk.length + word.length + 1 > maxLength && wordChunk.trim()) {
          finalChunks.push(wordChunk.trim());
          wordChunk = word;
        } else {
          wordChunk += (wordChunk ? ' ' : '') + word;
        }
      }
      
      if (wordChunk.trim()) {
        finalChunks.push(wordChunk.trim());
      }
    }
  }
  
  return finalChunks.filter(chunk => chunk.length > 0);
};

/**
 * Send single message (internal function)
 */
const sendSingleMessage = async (recipientId, messageText) => {
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded, queuing message');
    // In production, you might want to implement a proper queue
    throw new Error('Rate limit exceeded');
  }
  
  // Validate message length
  if (messageText.length > MESSAGE_CHAR_LIMIT) {
    throw new Error(`Message too long: ${messageText.length} characters (max: ${MESSAGE_CHAR_LIMIT})`);
  }
  
  const url = `${BASE_URL}/${process.env.INSTAGRAM_ACCOUNT_ID}/messages`;
  const headers = {
    'Authorization': `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9'
  };
  const data = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  
  try {
    const response = await axios.post(url, data, { headers });
    
    console.log(`✅ Message sent (${messageText.length} chars):`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send text message to Instagram user (with automatic splitting if needed)
 */
const sendMessage = async (recipientId, messageText) => {
  console.log(`📤 Preparing message for ${recipientId} (${messageText.length} chars)`);
  
  // Check if message needs splitting
  if (messageText.length <= MESSAGE_CHAR_LIMIT) {
    console.log(`📝 Single message (${messageText.length}/${MESSAGE_CHAR_LIMIT} chars)`);
    return await sendSingleMessage(recipientId, messageText);
  }
  
  // Split long message into chunks
  console.log(`✂️ Message too long (${messageText.length} chars), splitting...`);
  const chunks = splitMessage(messageText);
  console.log(`📄 Split into ${chunks.length} messages`);
  
  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkNumber = i + 1;
    
    // Add part indicator for multi-part messages
    let finalChunk = chunk;
    if (chunks.length > 1) {
      finalChunk = `📝 Part ${chunkNumber}/${chunks.length}:\n\n${chunk}`;
    }
    
    console.log(`📤 Sending part ${chunkNumber}/${chunks.length} (${finalChunk.length} chars)`);
    
    try {
      const result = await sendSingleMessage(recipientId, finalChunk);
      results.push(result);
      
      // Add small delay between messages to avoid overwhelming the user
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    } catch (error) {
      console.error(`❌ Failed to send part ${chunkNumber}/${chunks.length}:`, error.message);
      throw error;
    }
  }
  
  console.log(`✅ All ${chunks.length} message parts sent successfully`);
  return results;
};

/**
 * Send quick reply message with buttons
 */
const sendQuickReply = async (recipientId, messageText, quickReplies) => {
  console.log(`📤 Sending quick reply to ${recipientId} (${messageText.length} chars)`);
  
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded, queuing quick reply');
    throw new Error('Rate limit exceeded');
  }
  
  // Validate message length for quick replies (they can't be split)
  if (messageText.length > MESSAGE_CHAR_LIMIT) {
    console.log(`⚠️ Quick reply message too long (${messageText.length} chars), truncating...`);
    messageText = messageText.substring(0, MESSAGE_CHAR_LIMIT - 3) + '...';
  }
  
  const url = `${BASE_URL}/${process.env.INSTAGRAM_ACCOUNT_ID}/messages`;
  const headers = {
    'Authorization': `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9'
  };
  const data = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      quick_replies: quickReplies.map(reply => ({
        content_type: 'text',
        title: reply.title,
        payload: reply.payload
      }))
    }
  };
  
  try {
    const response = await axios.post(url, data, { headers });
    
    console.log('✅ Quick reply sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending quick reply:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send typing indicator
 */
const sendTypingIndicator = async (recipientId, action = 'typing_on') => {
  if (!rateLimiter.canMakeRequest()) {
    return; // Skip typing indicator if rate limited
  }
  
  const url = `${BASE_URL}/${process.env.INSTAGRAM_ACCOUNT_ID}/messages`;
  const headers = {
    'Authorization': `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9'
  };
  const data = {
    recipient: {
      id: recipientId
    },
    sender_action: action
  };
  
  // Generate and log cURL command
  const curlCommand = generateCurl('POST', url, headers, data);
  console.log('🔧 Equivalent cURL command for typing indicator:');
  console.log(curlCommand);
  
  try {
    await axios.post(url, data, { headers });
    
    console.log(`✅ Typing indicator sent: ${action}`);
  } catch (error) {
    console.error('❌ Error sending typing indicator:', error.response?.data || error.message);
  }
};

/**
 * Get user profile information
 */
const getUserProfile = async (userId) => {
  console.log(`👤 Getting profile for user ${userId}`);
  
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded, cannot get user profile');
    throw new Error('Rate limit exceeded');
  }
  
  try {
    const response = await axios.get(
      `${BASE_URL}/${userId}`,
      {
        params: {
          fields: 'name,profile_pic',
          access_token: process.env.INSTAGRAM_ACCESS_TOKEN
        },
        headers: {
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );
    
    console.log('✅ User profile retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error getting user profile:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Validate webhook signature
 */
const validateWebhookSignature = (payload, signature) => {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
};

/**
 * Get conversation history (if available)
 */
const getConversationHistory = async (userId) => {
  console.log(`📜 Getting conversation history for user ${userId}`);
  
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded, cannot get conversation history');
    throw new Error('Rate limit exceeded');
  }
  
  try {
    const response = await axios.get(
      `${BASE_URL}/${process.env.INSTAGRAM_ACCOUNT_ID}/conversations`,
      {
        params: {
          user_id: userId,
          access_token: process.env.INSTAGRAM_ACCESS_TOKEN
        },
        headers: {
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );
    
    console.log('✅ Conversation history retrieved');
    return response.data;
  } catch (error) {
    console.error('❌ Error getting conversation history:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage,
  sendQuickReply,
  sendTypingIndicator,
  getUserProfile,
  validateWebhookSignature,
  getConversationHistory,
  splitMessage,
  MESSAGE_CHAR_LIMIT
}; 