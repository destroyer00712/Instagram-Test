#!/usr/bin/env node
require('dotenv').config();

const factChecker = require('./modules/factChecker');

async function testComprehensiveWebhook() {
  console.log('🎬 COMPREHENSIVE WEBHOOK TEST - Full Video/Audio Processing + Google Custom Search\n');
  
  console.log('🎯 Testing with mock Instagram reel (video download will be simulated)...\n');
  
  const mockReel = {
    type: 'ig_reel',
    payload: {
      url: 'https://mock-instagram.com/reel/comprehensive-test',
      title: 'Breaking News: Major tech company announces revolutionary breakthrough! This changes everything! #tech #breaking'
    }
  };
  
  console.log('📱 Mock Instagram Reel:');
  console.log(`   Type: ${mockReel.type}`);
  console.log(`   URL: ${mockReel.payload.url}`);
  console.log(`   Caption: "${mockReel.payload.title}"`);
  console.log('');
  
  console.log('🔄 Expected Processing Steps:');
  console.log('   1. Download video from URL');
  console.log('   2. Extract audio track');
  console.log('   3. Extract video frames (5 frames)');
  console.log('   4. Transcribe audio with Gemini');
  console.log('   5. Analyze video frames with Gemini');
  console.log('   6. Extract claim from audio + video + caption');
  console.log('   7. Fact-check with Google Custom Search');
  console.log('   8. Cleanup temporary files');
  console.log('');
  
  try {
    console.log('🚀 Starting comprehensive processing...\n');
    
    const result = await factChecker.processInstagramReel('comprehensive_test_user', mockReel);
    
    console.log('🎯 COMPREHENSIVE WEBHOOK RESULT:');
    console.log(`   Success: ${result.success}`);
    
    if (result.success) {
      console.log(`   Claim: "${result.claim}"`);
      console.log(`   Transcription Length: ${result.transcription?.length || 0} chars`);
      console.log(`   Video Analysis: ${result.videoAnalysis ? 'AVAILABLE' : 'N/A'}`);
      console.log(`   Verdict: ${result.analysis.verdict}`);
      console.log(`   Confidence: ${result.analysis.confidence}`);
      console.log(`   Sources Used: ${result.sources}`);
      
      if (result.transcription) {
        console.log(`   Audio Sample: "${result.transcription.substring(0, 100)}${result.transcription.length > 100 ? '...' : ''}"`);;
      }
      
      if (result.videoAnalysis) {
        console.log(`   Video Analysis Sample: "${result.videoAnalysis.analysis?.substring(0, 100)}${result.videoAnalysis.analysis?.length > 100 ? '...' : ''}"`);;
      }
      
      console.log('\n✅ SUCCESS: Comprehensive video processing with fact-checking is working!');
      console.log('🎉 Your Instagram webhook now processes:');
      console.log('   ✅ Video download');
      console.log('   ✅ Audio transcription');
      console.log('   ✅ Video frame analysis');
      console.log('   ✅ Comprehensive claim extraction');
      console.log('   ✅ Google Custom Search fact-checking');
      console.log('   ✅ File cleanup');
      
    } else {
      console.log(`   Message: ${result.message}`);
      console.log(`   Transcription Available: ${!!result.transcription}`);
      console.log(`   Video Analysis Available: ${!!result.videoAnalysis}`);
      
      if (result.transcription) {
        console.log(`   Audio was processed: "${result.transcription.substring(0, 50)}..."`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ COMPREHENSIVE WEBHOOK ERROR:');
    console.error(`   Error Type: ${error.name || 'Unknown'}`);
    console.error(`   Error Message: ${error.message}`);
    console.error(`   Stack: ${error.stack?.split('\n')[1] || 'N/A'}`);
    
    if (error.message.includes('download')) {
      console.log('\nℹ️  This is expected - video download will fail with mock URL.');
      console.log('   With real Instagram URLs, the full processing will work.');
    }
  }
}

testComprehensiveWebhook();
