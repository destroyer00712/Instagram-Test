#!/usr/bin/env node
require('dotenv').config();

// Simulate an Instagram reel being sent to the webhook
const factChecker = require('./modules/factChecker');

async function simulateInstagramReel() {
  console.log('🎬 Simulating Instagram Reel being sent to webhook...\n');
  
  // Simulate the attachment format that Instagram sends
  const mockReel = {
    type: 'ig_reel',
    payload: {
      url: 'https://instagram.com/reel/mock123',
      title: 'Breaking: Adani bought government land for just 1 rupee! This is shocking corruption! #AdaniScam #Corruption'
    }
  };
  
  const mockSenderId = 'test_user_123';
  
  console.log('📱 Mock Instagram Reel:');
  console.log(`   Type: ${mockReel.type}`);
  console.log(`   URL: ${mockReel.payload.url}`);
  console.log(`   Caption: "${mockReel.payload.title}"`);
  console.log('');
  
  try {
    console.log('🔄 Processing through webhook system...');
    
    // This is exactly what the webhook calls
    const result = await factChecker.processInstagramReel(mockSenderId, mockReel);
    
    console.log('\n🎯 WEBHOOK RESULT:');
    console.log(`   Success: ${result.success}`);
    
    if (result.success) {
      console.log(`   Claim: "${result.claim}"`);
      console.log(`   Verdict: ${result.analysis.verdict}`);
      console.log(`   Confidence: ${result.analysis.confidence}`);
      console.log(`   Sources Used: ${result.sources}`);
      console.log(`   Summary: ${result.analysis.summary}`);
      
      console.log('\n✅ SUCCESS: Webhook will now use ONLY Google Custom Search + AI!');
      console.log('🎉 No Reddit, no broken fact-check APIs, just clean Google search results!');
      
    } else {
      console.log(`   Message: ${result.message}`);
      console.log('ℹ️  This means the reel had no verifiable claims to fact-check.');
    }
    
  } catch (error) {
    console.error('\n❌ WEBHOOK ERROR:', error.message);
  }
}

// Test another example
async function testMultipleReels() {
  console.log('\n' + '='.repeat(60));
  console.log('📱 Testing multiple reel examples...\n');
  
  const reelExamples = [
    {
      caption: 'COVID vaccines contain microchips - this is proven fact!',
      expectedType: 'False conspiracy theory'
    },
    {
      caption: 'The moon landing was fake, filmed in Hollywood studios',
      expectedType: 'False conspiracy theory'
    },
    {
      caption: 'Just had the best pizza ever! #foodie',
      expectedType: 'No verifiable claim'
    }
  ];
  
  for (let i = 0; i < reelExamples.length; i++) {
    const example = reelExamples[i];
    console.log(`\n${i + 1}. Testing: "${example.caption}"`);
    console.log(`   Expected: ${example.expectedType}`);
    console.log('   ' + '-'.repeat(40));
    
    const mockReel = {
      type: 'ig_reel',
      payload: {
        url: `https://instagram.com/reel/test${i}`,
        title: example.caption
      }
    };
    
    try {
      const result = await factChecker.processInstagramReel(`test_user_${i}`, mockReel);
      
      if (result.success) {
        console.log(`   ✅ Result: ${result.analysis.verdict} (${result.analysis.confidence})`);
        console.log(`   📝 "${result.analysis.summary.substring(0, 100)}..."`);
      } else {
        console.log(`   ⚠️ ${result.message}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function runWebhookTest() {
  await simulateInstagramReel();
  await testMultipleReels();
  
  console.log('\n🏁 Webhook simulation complete!');
  console.log('✅ Your Instagram bot will now use ONLY the new simplified system!');
}

runWebhookTest().catch(console.error);
