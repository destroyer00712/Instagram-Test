#!/usr/bin/env node

/**
 * Test script to simulate Instagram webhook messages
 * This helps you test your bot locally without needing real Instagram messages
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const WEBHOOK_URL = 'http://localhost:3000/webhook';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret_here';

// Sample message payloads
const sampleMessages = {
  textMessage: {
    object: 'instagram',
    entry: [
      {
        id: 'instagram_account_id',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'test_user_123' },
            recipient: { id: 'your_bot_account_id' },
            timestamp: Date.now(),
            message: {
              mid: 'test_message_id',
              text: 'Hello bot!'
            }
          }
        ]
      }
    ]
  },
  
  helpMessage: {
    object: 'instagram',
    entry: [
      {
        id: 'instagram_account_id',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'test_user_123' },
            recipient: { id: 'your_bot_account_id' },
            timestamp: Date.now(),
            message: {
              mid: 'test_message_id_2',
              text: 'help'
            }
          }
        ]
      }
    ]
  },
  
  menuMessage: {
    object: 'instagram',
    entry: [
      {
        id: 'instagram_account_id',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'test_user_123' },
            recipient: { id: 'your_bot_account_id' },
            timestamp: Date.now(),
            message: {
              mid: 'test_message_id_3',
              text: 'menu'
            }
          }
        ]
      }
    ]
  },
  
  attachmentMessage: {
    object: 'instagram',
    entry: [
      {
        id: 'instagram_account_id',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'test_user_123' },
            recipient: { id: 'your_bot_account_id' },
            timestamp: Date.now(),
            message: {
              mid: 'test_message_id_4',
              attachments: [
                {
                  type: 'image',
                  payload: {
                    url: 'https://example.com/image.jpg'
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
};

/**
 * Generate webhook signature
 */
function generateSignature(payload) {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Send test message to webhook
 */
async function sendTestMessage(messageType) {
  const payload = sampleMessages[messageType];
  
  if (!payload) {
    console.error(`❌ Unknown message type: ${messageType}`);
    console.log(`Available types: ${Object.keys(sampleMessages).join(', ')}`);
    return;
  }
  
  const signature = generateSignature(payload);
  
  try {
    console.log(`📤 Sending ${messageType} to webhook...`);
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature
      }
    });
    
    console.log(`✅ Response: ${response.status} ${response.statusText}`);
    console.log(`📋 Message: ${response.data}`);
    
  } catch (error) {
    console.error(`❌ Error sending message:`, error.message);
    if (error.response) {
      console.error(`📋 Response: ${error.response.status} ${error.response.statusText}`);
      console.error(`📋 Data:`, error.response.data);
    }
  }
}

/**
 * Test webhook verification
 */
async function testWebhookVerification() {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token';
  const challenge = 'test_challenge_123';
  
  try {
    console.log('🔍 Testing webhook verification...');
    
    const response = await axios.get(WEBHOOK_URL, {
      params: {
        'hub.mode': 'subscribe',
        'hub.challenge': challenge,
        'hub.verify_token': verifyToken
      }
    });
    
    console.log(`✅ Verification successful: ${response.data}`);
    
  } catch (error) {
    console.error(`❌ Verification failed:`, error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Starting Instagram Webhook Tests');
  console.log('=====================================');
  
  // Test webhook verification
  await testWebhookVerification();
  
  console.log('\n📨 Testing message handling...');
  
  // Test different message types
  await sendTestMessage('textMessage');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await sendTestMessage('helpMessage');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await sendTestMessage('menuMessage');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await sendTestMessage('attachmentMessage');
  
  console.log('\n🎉 Tests completed!');
  console.log('Check your bot server logs to see the processing results.');
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🧪 Instagram Webhook Tester');
    console.log('Usage: node test-webhook.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  verify          - Test webhook verification');
    console.log('  message [type]  - Send test message (textMessage, helpMessage, menuMessage, attachmentMessage)');
    console.log('  all             - Run all tests');
    console.log('');
    console.log('Examples:');
    console.log('  node test-webhook.js verify');
    console.log('  node test-webhook.js message textMessage');
    console.log('  node test-webhook.js all');
    process.exit(0);
  }
  
  const command = args[0];
  
  switch (command) {
    case 'verify':
      testWebhookVerification();
      break;
      
    case 'message':
      const messageType = args[1] || 'textMessage';
      sendTestMessage(messageType);
      break;
      
    case 'all':
      runTests();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }
}

module.exports = {
  sendTestMessage,
  testWebhookVerification,
  runTests
}; 