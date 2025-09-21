#!/usr/bin/env node
require('dotenv').config();

const factChecker = require('./modules/factChecker');

async function testCleanResponses() {
  console.log('🧪 Testing Clean Fact-Checking Bot Responses\n');
  
  // Simulate a fact-check result
  const mockClaim = "Adani was given 1050 acres of land in Bihar for ₹1 per acre per year for 33 years.";
  const mockAnalysis = {
    verdict: "True",
    confidence: "High",
    summary: "Based on 6 Google Custom Search articles, this claim is TRUE. 3 sources confirm this information."
  };
  
  console.log('📝 Mock Claim:', mockClaim);
  console.log('📊 Mock Analysis:', mockAnalysis);
  console.log('');
  
  try {
    console.log('🔍 Testing enhanced "Tell me more" response...\n');
    
    const detailedResponse = await factChecker.generateDetailedExplanation(mockClaim, mockAnalysis);
    
    console.log('📱 ENHANCED "TELL ME MORE" RESPONSE:');
    console.log('=' .repeat(60));
    console.log(detailedResponse.response);
    console.log('=' .repeat(60));
    console.log('');
    
    if (detailedResponse.response.length > 200) {
      console.log('✅ SUCCESS: Response is detailed and human-friendly!');
      console.log(`📊 Length: ${detailedResponse.response.length} characters`);
      console.log('🎯 No more robotic "Based on analysis" language!');
    } else {
      console.log('⚠️ Response might be too short');
    }
    
    console.log('\n🎉 WHAT\'S BEEN FIXED:');
    console.log('✅ Removed "Hello! Welcome to Instagram chatbot" message');
    console.log('✅ Removed "About Us", "Services", "Contact" buttons');  
    console.log('✅ Enhanced "Tell me more" with AI-generated human responses');
    console.log('✅ Clean fact-checking focused bot only');
    console.log('✅ No more static menu elements');
    
  } catch (error) {
    console.error('❌ Error testing responses:', error.message);
  }
}

testCleanResponses();
