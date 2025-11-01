const axios = require('axios');
const http = require('http');
const https = require('https');

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

// Retry configuration for API calls
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second initial delay
  timeout: 45000 // 45 second timeout per request (increased for GCP)
};

// Configure axios instance for GCP/Cloud Run
// Note: Using default agents works better in Cloud Run's network layer
const axiosInstance = axios.create({
  timeout: RETRY_CONFIG.timeout
  // Default agents work better in serverless environments - no keep-alive needed
});

// GCP requires Metadata-Flavor header for external API requests
const getDefaultHeaders = () => ({
  'Metadata-Flavor': 'Google'
});

/**
 * Retry helper with exponential backoff
 */
const retryRequest = async (requestFn, retries = RETRY_CONFIG.maxRetries) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt}/${retries}...`);
      }
      return await requestFn();
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const isTimeoutError = error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
      // ECONNABORTED is common in GCP and should be retried (connection aborted before completion)
      const isConnectionError = error.code === 'ECONNREFUSED' || 
                                error.code === 'ECONNRESET' || 
                                error.code === 'ECONNABORTED' ||
                                error.code === 'ENOTFOUND' ||
                                error.code === 'EAI_AGAIN';
      
      // Log detailed error info on retry
      console.error(`⚠️ Attempt ${attempt + 1}/${retries + 1} failed:`);
      console.error(`   Error code: ${error.code}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Is timeout: ${isTimeoutError}`);
      console.error(`   Is connection error: ${isConnectionError}`);
      
      if (error.response) {
        console.error(`   HTTP Status: ${error.response.status}`);
        console.error(`   Response data:`, JSON.stringify(error.response.data, null, 2));
      }
      
      // Don't retry on last attempt or non-retryable errors
      if (isLastAttempt || (!isTimeoutError && !isConnectionError)) {
        console.error(`❌ Not retrying - ${isLastAttempt ? 'last attempt reached' : 'non-retryable error'}`);
        throw error;
      }
      
      // Exponential backoff: wait 1s, 2s, 4s
      const delay = RETRY_CONFIG.retryDelay * Math.pow(2, attempt);
      console.log(`⚠️ Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`, error.code);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
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
    ...getDefaultHeaders(), // GCP required header
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
  
  // Log detailed API call information for debugging
  const maskedToken = process.env.INSTAGRAM_ACCESS_TOKEN 
    ? `${process.env.INSTAGRAM_ACCESS_TOKEN.substring(0, 10)}...${process.env.INSTAGRAM_ACCESS_TOKEN.substring(process.env.INSTAGRAM_ACCESS_TOKEN.length - 5)}`
    : 'NOT_SET';
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 INSTAGRAM API CALL DETAILS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 URL: ${url}`);
  console.log(`📋 Method: POST`);
  console.log(`⏱️  Timeout: ${RETRY_CONFIG.timeout}ms`);
  console.log(`🌐 Metadata-Flavor: Google (GCP required)`);
  console.log(`🔑 Authorization: Bearer ${maskedToken}`);
  console.log(`📦 Request Body:`, JSON.stringify(data, null, 2));
  console.log(`👤 Recipient ID: ${recipientId}`);
  console.log(`💬 Message Length: ${messageText.length} chars`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 cURL Command (copy to test locally):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const curlCommand = `curl --location --request POST '${url}' \\
  --header 'Metadata-Flavor: Google' \\
  --header 'Authorization: Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}' \\
  --header 'Content-Type: application/json' \\
  --header 'Accept-Language: en-US,en;q=0.9' \\
  --data '${JSON.stringify(data)}'`;
  console.log(curlCommand);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    console.log(`📡 Sending message to Instagram API (timeout: ${RETRY_CONFIG.timeout}ms)...`);
    const response = await retryRequest(async () => {
      return await axiosInstance.post(url, data, { 
        headers,
        timeout: RETRY_CONFIG.timeout,
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      });
    });
    
    if (response.status >= 400) {
      console.error(`❌ Instagram API error ${response.status}:`, response.data);
      throw new Error(`Instagram API returned ${response.status}: ${JSON.stringify(response.data)}`);
    }
    
    console.log(`✅ Message sent successfully (${messageText.length} chars)`);
    console.log(`✅ Response status: ${response.status}`);
    console.log(`✅ Response data:`, JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERROR DETAILS:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ Error code: ${error.code}`);
    console.error(`❌ Error message: ${error.message}`);
    console.error(`❌ Is timeout: ${error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED'}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
      console.error(`❌ Response data:`, JSON.stringify(error.response.data, null, 2));
      console.error(`❌ Response headers:`, JSON.stringify(error.response.headers, null, 2));
    }
    if (error.request) {
      console.error(`❌ Request made but no response received`);
      console.error(`❌ Request config:`, JSON.stringify({
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout,
        headers: error.config?.headers ? Object.keys(error.config.headers) : null
      }, null, 2));
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
    ...getDefaultHeaders(), // GCP required header
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
    console.log(`📡 Sending quick reply to Instagram API (timeout: ${RETRY_CONFIG.timeout}ms)...`);
    const response = await retryRequest(async () => {
      return await axiosInstance.post(url, data, { 
        headers,
        timeout: RETRY_CONFIG.timeout,
        validateStatus: (status) => status < 500
      });
    });
    
    if (response.status >= 400) {
      console.error(`❌ Instagram API error ${response.status}:`, response.data);
      throw new Error(`Instagram API returned ${response.status}: ${JSON.stringify(response.data)}`);
    }
    
    console.log('✅ Quick reply sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending quick reply:', error.response?.data || error.message);
    console.error('❌ Error code:', error.code, '| Timeout:', error.code === 'ETIMEDOUT');
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
    ...getDefaultHeaders(), // GCP required header
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
    await retryRequest(async () => {
      return await axiosInstance.post(url, data, { 
        headers,
        timeout: RETRY_CONFIG.timeout,
        validateStatus: (status) => status < 500
      });
    }, 2); // Only 2 retries for typing indicator (non-critical)
    
    console.log(`✅ Typing indicator sent: ${action}`);
  } catch (error) {
    console.error('❌ Error sending typing indicator (non-critical):', error.response?.data || error.message);
    // Don't throw - typing indicator is non-critical
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
    const response = await retryRequest(async () => {
      return await axiosInstance.get(
        `${BASE_URL}/${userId}`,
        {
          params: {
            fields: 'name,profile_pic',
            access_token: process.env.INSTAGRAM_ACCESS_TOKEN
          },
          headers: {
            ...getDefaultHeaders(), // GCP required header
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: RETRY_CONFIG.timeout,
          validateStatus: (status) => status < 500
        }
      );
    });
    
    if (response.status >= 400) {
      console.error(`❌ Instagram API error ${response.status}:`, response.data);
      throw new Error(`Instagram API returned ${response.status}`);
    }
    
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
    const response = await retryRequest(async () => {
      return await axiosInstance.get(
        `${BASE_URL}/${process.env.INSTAGRAM_ACCOUNT_ID}/conversations`,
        {
          params: {
            user_id: userId,
            access_token: process.env.INSTAGRAM_ACCESS_TOKEN
          },
          headers: {
            ...getDefaultHeaders(), // GCP required header
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: RETRY_CONFIG.timeout,
          validateStatus: (status) => status < 500
        }
      );
    });
    
    if (response.status >= 400) {
      console.error(`❌ Instagram API error ${response.status}:`, response.data);
      throw new Error(`Instagram API returned ${response.status}`);
    }
    
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