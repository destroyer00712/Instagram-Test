#!/usr/bin/env node

/**
 * Test script to send a message from chatloom.in to _setty.naman_
 * This tests the Instagram API before setting up webhooks
 */

const axios = require('axios');
require('dotenv').config();

// Account IDs from your Facebook Developer Console
const SENDER_ID = process.env.INSTAGRAM_ACCOUNT_ID || '1784147260142095';  // chatloom.in
const RECIPIENT_ID = '1784147210010479';  // _setty.naman_

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

/**
 * Send a test message
 */
async function sendTestMessage() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  console.log(accessToken);
  if (!accessToken) {
    console.error('❌ No access token found. Please set INSTAGRAM_ACCESS_TOKEN in your .env file');
    return;
  }
  
  const messageText = 'Hello from chatloom.in! 🤖 This is a test message from your Instagram bot.';
  
  const url = `https://graph.instagram.com/v23.0/${SENDER_ID}/messages`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9'
  };
  const data = {
    recipient: {
      id: RECIPIENT_ID
    },
    message: {
      text: messageText
    }
  };
  
  try {
    console.log('📤 Sending test message...');
    console.log(`From: chatloom.in (${SENDER_ID})`);
    console.log(`To: _setty.naman_ (${RECIPIENT_ID})`);
    console.log(`Message: ${messageText}`);
    
    // Generate and log cURL command
    const curlCommand = generateCurl('POST', url, headers, data);
    console.log('\n🔧 Equivalent cURL command:');
    console.log(curlCommand);
    console.log('\n');
    
    const response = await axios.post(url, data, { headers });
    
    console.log('✅ Message sent successfully!');
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    
    if (error.response) {
      console.error('📋 Status:', error.response.status);
      console.error('📋 Error details:', JSON.stringify(error.response.data, null, 2));
      
      // Common error explanations
      if (error.response.status === 400) {
        console.error('\n💡 This might be because:');
        console.error('- The access token is invalid or expired');
        console.error('- The recipient hasn\'t started a conversation with your business account');
        console.error('- Your app doesn\'t have the necessary permissions');
      }
    }
  }
}

/**
 * Test access token validity
 */
async function testAccessToken() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  
  try {
    console.log('🔍 Testing access token...');
    
    const url = `https://graph.instagram.com/v23.0/${SENDER_ID}?fields=id,name,username&access_token=${accessToken}`;
    
    // Generate and log cURL command
    const curlCommand = generateCurl('GET', url, {}, null);
    console.log('\n🔧 Equivalent cURL command for token test:');
    console.log(curlCommand);
    console.log('\n');
    
    const response = await axios.get(
      `https://graph.instagram.com/v23.0/${SENDER_ID}`,
      {
        params: {
          fields: 'id,name,username',
          access_token: accessToken
        },
        headers: {
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );
    
    console.log('✅ Access token is valid!');
    console.log('📋 Account info:', JSON.stringify(response.data, null, 2));
    
    return true;
    
  } catch (error) {
    console.error('❌ Access token test failed:', error.message);
    if (error.response) {
      console.error('📋 Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🧪 Instagram Message Test');
  console.log('========================');
  
  // Test access token first
  const tokenValid = await testAccessToken();
  
  if (!tokenValid) {
    console.error('\n❌ Access token is invalid. Please generate a new one from Facebook Developer Console.');
    return;
  }
  
  console.log('\n📨 Attempting to send message...');
  await sendTestMessage();
  
  console.log('\n📝 Note: If the message fails, make sure:');
  console.log('1. _setty.naman_ has started a conversation with chatloom.in first');
  console.log('2. Both accounts are Instagram Business/Creator accounts');
  console.log('3. chatloom.in is connected to a Facebook Page');
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { sendTestMessage, testAccessToken }; 