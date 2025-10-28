const axios = require('axios');

// WhatsApp Business API base URL
const BASE_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;

// WhatsApp message limits
const MESSAGE_CHAR_LIMIT = 4096; // WhatsApp's character limit per message
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
  maxRequests: process.env.WHATSAPP_RATE_LIMIT_REQUESTS_PER_MINUTE || 1000, // WhatsApp allows more requests
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
 * Send a text message via WhatsApp Business API
 */
const sendMessage = async (to, messageText) => {
  console.log(`📱 Sending WhatsApp message to ${to}: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`);
  
  // Check rate limiting
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded for WhatsApp API');
    throw new Error('Rate limit exceeded');
  }
  
  // Split long messages
  const messages = splitMessage(messageText);
  
  for (const [index, message] of messages.entries()) {
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: {
        body: message
      }
    };
    
    const headers = {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    const url = `${BASE_URL}/messages`;
    
    try {
      console.log(`📤 Sending WhatsApp message ${index + 1}/${messages.length} to ${to}`);
      
      const response = await axios.post(url, payload, { headers });
      
      if (response.data.messages && response.data.messages[0]) {
        const messageId = response.data.messages[0].id;
        console.log(`✅ WhatsApp message sent successfully: ${messageId}`);
        
        // Add small delay between messages to avoid overwhelming
        if (index < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        console.log('⚠️ Unexpected WhatsApp API response:', response.data);
      }
      
    } catch (error) {
      console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
      
      // Log cURL command for debugging
      console.log('🔧 Debug cURL command:');
      console.log(generateCurl('POST', url, headers, payload));
      
      throw error;
    }
  }
};

/**
 * Send a media message (image, video, audio, document) via WhatsApp
 */
const sendMediaMessage = async (to, mediaType, mediaUrl, caption = '') => {
  console.log(`📱 Sending WhatsApp ${mediaType} to ${to}${caption ? ` with caption: "${caption}"` : ''}`);
  
  // Check rate limiting
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded for WhatsApp API');
    throw new Error('Rate limit exceeded');
  }
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: mediaType,
    [mediaType]: {
      link: mediaUrl,
      caption: caption
    }
  };
  
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  const url = `${BASE_URL}/messages`;
  
  try {
    console.log(`📤 Sending WhatsApp ${mediaType} to ${to}`);
    
    const response = await axios.post(url, payload, { headers });
    
    if (response.data.messages && response.data.messages[0]) {
      const messageId = response.data.messages[0].id;
      console.log(`✅ WhatsApp ${mediaType} sent successfully: ${messageId}`);
    } else {
      console.log('⚠️ Unexpected WhatsApp API response:', response.data);
    }
    
  } catch (error) {
    console.error(`❌ Error sending WhatsApp ${mediaType}:`, error.response?.data || error.message);
    
    // Log cURL command for debugging
    console.log('🔧 Debug cURL command:');
    console.log(generateCurl('POST', url, headers, payload));
    
    throw error;
  }
};

/**
 * Send an interactive message with buttons via WhatsApp
 */
const sendInteractiveMessage = async (to, headerText, bodyText, footerText, buttons) => {
  console.log(`📱 Sending WhatsApp interactive message to ${to}`);
  
  // Check rate limiting
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded for WhatsApp API');
    throw new Error('Rate limit exceeded');
  }
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'text',
        text: headerText
      },
      body: {
        text: bodyText
      },
      footer: {
        text: footerText
      },
      action: {
        buttons: buttons.map((button, index) => ({
          type: 'reply',
          reply: {
            id: `btn_${index}`,
            title: button
          }
        }))
      }
    }
  };
  
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  const url = `${BASE_URL}/messages`;
  
  try {
    console.log(`📤 Sending WhatsApp interactive message to ${to}`);
    
    const response = await axios.post(url, payload, { headers });
    
    if (response.data.messages && response.data.messages[0]) {
      const messageId = response.data.messages[0].id;
      console.log(`✅ WhatsApp interactive message sent successfully: ${messageId}`);
    } else {
      console.log('⚠️ Unexpected WhatsApp API response:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Error sending WhatsApp interactive message:', error.response?.data || error.message);
    
    // Log cURL command for debugging
    console.log('🔧 Debug cURL command:');
    console.log(generateCurl('POST', url, headers, payload));
    
    throw error;
  }
};

/**
 * Send a list message via WhatsApp
 */
const sendListMessage = async (to, headerText, bodyText, footerText, buttonText, sections) => {
  console.log(`📱 Sending WhatsApp list message to ${to}`);
  
  // Check rate limiting
  if (!rateLimiter.canMakeRequest()) {
    console.log('⚠️ Rate limit exceeded for WhatsApp API');
    throw new Error('Rate limit exceeded');
  }
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: {
        type: 'text',
        text: headerText
      },
      body: {
        text: bodyText
      },
      footer: {
        text: footerText
      },
      action: {
        button: buttonText,
        sections: sections
      }
    }
  };
  
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  const url = `${BASE_URL}/messages`;
  
  try {
    console.log(`📤 Sending WhatsApp list message to ${to}`);
    
    const response = await axios.post(url, payload, { headers });
    
    if (response.data.messages && response.data.messages[0]) {
      const messageId = response.data.messages[0].id;
      console.log(`✅ WhatsApp list message sent successfully: ${messageId}`);
    } else {
      console.log('⚠️ Unexpected WhatsApp API response:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Error sending WhatsApp list message:', error.response?.data || error.message);
    
    // Log cURL command for debugging
    console.log('🔧 Debug cURL command:');
    console.log(generateCurl('POST', url, headers, payload));
    
    throw error;
  }
};

/**
 * Mark message as read
 */
const markAsRead = async (messageId) => {
  console.log(`📖 Marking WhatsApp message as read: ${messageId}`);
  
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };
  
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  const url = `${BASE_URL}/messages`;
  
  try {
    const response = await axios.post(url, payload, { headers });
    console.log(`✅ WhatsApp message marked as read: ${messageId}`);
  } catch (error) {
    console.error('❌ Error marking WhatsApp message as read:', error.response?.data || error.message);
  }
};

/**
 * Split long messages into smaller chunks
 */
const splitMessage = (messageText) => {
  if (messageText.length <= MESSAGE_CHAR_LIMIT) {
    return [messageText];
  }
  
  const messages = [];
  let remaining = messageText;
  
  while (remaining.length > 0) {
    if (remaining.length <= MESSAGE_CHAR_LIMIT) {
      messages.push(remaining);
      break;
    }
    
    // Find the last space before the limit to avoid splitting words
    let splitPoint = MESSAGE_CHAR_LIMIT - MESSAGE_SPLIT_BUFFER;
    while (splitPoint > 0 && remaining[splitPoint] !== ' ') {
      splitPoint--;
    }
    
    // If no space found, split at the limit
    if (splitPoint === 0) {
      splitPoint = MESSAGE_CHAR_LIMIT - MESSAGE_SPLIT_BUFFER;
    }
    
    messages.push(remaining.substring(0, splitPoint).trim());
    remaining = remaining.substring(splitPoint).trim();
  }
  
  return messages;
};

/**
 * Get media URL from WhatsApp media ID
 */
const getMediaUrl = async (mediaId) => {
  console.log(`📎 Getting WhatsApp media URL for ID: ${mediaId}`);
  
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
  };
  
  const url = `https://graph.facebook.com/v18.0/${mediaId}`;
  
  try {
    const response = await axios.get(url, { headers });
    
    if (response.data.url) {
      console.log(`✅ WhatsApp media URL retrieved: ${response.data.url}`);
      return response.data.url;
    } else {
      console.log('⚠️ No URL found in WhatsApp media response:', response.data);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error getting WhatsApp media URL:', error.response?.data || error.message);
    return null;
  }
};

/**
 * Download media from WhatsApp
 */
const downloadMedia = async (mediaUrl) => {
  console.log(`📥 Downloading WhatsApp media from: ${mediaUrl}`);
  
  const headers = {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
  };
  
  try {
    const response = await axios.get(mediaUrl, { 
      headers,
      responseType: 'arraybuffer'
    });
    
    console.log(`✅ WhatsApp media downloaded: ${response.data.length} bytes`);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error downloading WhatsApp media:', error.response?.data || error.message);
    return null;
  }
};

module.exports = {
  sendMessage,
  sendMediaMessage,
  sendInteractiveMessage,
  sendListMessage,
  markAsRead,
  getMediaUrl,
  downloadMedia,
  splitMessage
};
