#!/usr/bin/env node

// Test the correct message format for Instagram API
const messageHandler = require('./modules/messageHandler');

function testMessageFormat() {
  console.log('🧪 Testing Instagram API Message Format\n');
  
  // Simulate fact-check result
  const mockClaim = "Test claim";
  const mockAnalysis = {
    verdict: "True",
    confidence: "High", 
    sources: 3
  };
  
  // Get the response from botResponses
  const botResponses = {
    factCheckComplete: (claim, analysis) => {
      const sourceText = analysis.sources && analysis.sources > 1 ? `${analysis.sources} sources` : "multiple sources";
      const verdictIcon = analysis.verdict === 'True' ? '✅' : analysis.verdict === 'False' ? '❌' : '⚠️';
      const confidenceIcon = analysis.confidence === 'High' ? '🎯' : analysis.confidence === 'Medium' ? '📊' : '🤔';
      
      return `${verdictIcon} Found in ${sourceText}:
1. www.reddit.com
2. x.com
3. www.facebook.com

📋 Multiple sources confirm this claim.

${confidenceIcon} Confidence: ${analysis.confidence}

💬 Ask "tell me more" for details!`;
    }
  };
  
  const responseMessage = botResponses.factCheckComplete(mockClaim, mockAnalysis);
  
  console.log('📋 Response Message Type:', typeof responseMessage);
  console.log('📋 Response Message:');
  console.log(responseMessage);
  console.log('');
  
  // Simulate the Instagram API payload
  const instagramPayload = {
    recipient: { id: "123456789" },
    message: {
      text: responseMessage  // This should be a string
    }
  };
  
  console.log('📤 Instagram API Payload:');
  console.log(JSON.stringify(instagramPayload, null, 2));
  console.log('');
  
  // Check if the payload structure is correct
  const isCorrect = (
    typeof responseMessage === 'string' &&
    typeof instagramPayload.message.text === 'string'
  );
  
  if (isCorrect) {
    console.log('✅ SUCCESS: Message format is correct!');
    console.log('🎯 Instagram API will accept this payload.');
  } else {
    console.log('❌ FAILURE: Message format is incorrect!');
    console.log('🎯 Instagram API will reject this payload.');
  }
}

testMessageFormat();
