#!/usr/bin/env node
require('dotenv').config();

const factChecker = require('./modules/factChecker');

async function testFinalWebhook() {
  console.log('🎬 FINAL WEBHOOK TEST - Testing conspiracy theory detection\n');
  
  const testReel = {
    type: 'ig_reel',
    payload: {
      url: 'https://instagram.com/reel/conspiracy123',
      title: 'COVID vaccines contain microchips! This is proven fact! Wake up people! #conspiracy #truth'
    }
  };
  
  console.log('📱 Testing conspiracy theory reel:');
  console.log(`   Caption: "${testReel.payload.title}"`);
  console.log('   Expected: Should detect as FALSE\n');
  
  try {
    const result = await factChecker.processInstagramReel('final_test_user', testReel);
    
    console.log('🎯 FINAL WEBHOOK RESULT:');
    console.log(`   Success: ${result.success}`);
    
    if (result.success) {
      console.log(`   Claim: "${result.claim}"`);
      console.log(`   Verdict: ${result.analysis.verdict}`);
      console.log(`   Confidence: ${result.analysis.confidence}`);
      
      if (result.analysis.verdict === 'False') {
        console.log('\n✅ SUCCESS: Conspiracy theory correctly detected as FALSE!');
        console.log('🎉 Your Instagram webhook is now working perfectly!');
        console.log('📱 Users can send reels and get accurate fact-checking results!');
      } else {
        console.log('\n⚠️ Still getting', result.analysis.verdict, 'instead of False');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFinalWebhook();
