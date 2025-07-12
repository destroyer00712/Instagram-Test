const axios = require('axios');

// Instagram Graph API base URL
const BASE_URL = 'https://graph.facebook.com/v18.0';

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
 * Send text message to Instagram user
 */
const sendMessage = async (recipientId, messageText) => {
  console.log(`📤 Sending message to ${recipientId}: ${messageText}`);
  
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded, queuing message');
    // In production, you might want to implement a proper queue
    throw new Error('Rate limit exceeded');
  }
  
  try {
    const response = await axios.post(
      `${BASE_URL}/me/messages`,
      {
        recipient: {
          id: recipientId
        },
        message: {
          text: messageText
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send quick reply message with buttons
 */
const sendQuickReply = async (recipientId, messageText, quickReplies) => {
  console.log(`📤 Sending quick reply to ${recipientId}`);
  
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded, queuing quick reply');
    throw new Error('Rate limit exceeded');
  }
  
  try {
    const response = await axios.post(
      `${BASE_URL}/me/messages`,
      {
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
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
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
  
  try {
    await axios.post(
      `${BASE_URL}/me/messages`,
      {
        recipient: {
          id: recipientId
        },
        sender_action: action
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
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
      `${BASE_URL}/me/conversations`,
      {
        params: {
          user_id: userId,
          access_token: process.env.INSTAGRAM_ACCESS_TOKEN
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
  getConversationHistory
}; 