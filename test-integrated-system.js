#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config();

const factChecker = require('./modules/factChecker');

console.log('🔑 Initializing Gemini AI...');
console.log('🚀 Testing INTEGRATED SYSTEM with conspiracy detection\n');

async function testIntegratedConspiracyDetection() {
  const testClaims = [
    "COVID-19 vaccines contain microchips",
    "The moon landing was filmed on a movie set", 
    "Elon Musk bought CNN for $3 billion"
  ];

  console.log('📋 Testing with CURRENT factChecker.js system...\n');
  
  for (let i = 0; i < testClaims.length; i++) {
    const claim = testClaims[i];
    console.log(`\n${i + 1}. Testing: "${claim}"`);
    console.log('=' + '='.repeat(50));
    
    try {
      // Use the existing factChecker system
      const factCheckResults = await factChecker.searchFactChecks(claim);
      console.log(`✅ Found ${factCheckResults.length} fact-check results`);
      
      if (factCheckResults.length > 0) {
        const analysis = await factChecker.analyzeFactChecks(factCheckResults, claim);
        
        console.log(`📊 RESULT: ${analysis.verdict} (${analysis.confidence} confidence)`);
        console.log(`📝 Summary: ${analysis.summary ? analysis.summary.substring(0, 100) + '...' : 'No summary'}`);
        
        if (analysis.verdict === 'False') {
          console.log('✅ SUCCESS: Correctly detected as FALSE');
        } else {
          console.log(`❌ ISSUE: Expected FALSE, got ${analysis.verdict}`);
        }
      } else {
        console.log('❌ PROBLEM: No fact-check results found');
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 Integration test completed');
}

if (require.main === module) {
  testIntegratedConspiracyDetection().catch(error => {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  });
}
