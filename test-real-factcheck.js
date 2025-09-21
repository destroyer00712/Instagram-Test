#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config();

const factChecker = require('./modules/factChecker');

console.log('🔑 Initializing Gemini AI...');
console.log('🔑 GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('🔑 GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined');

console.log('\n🚀 Testing REAL Fact-Checking Cases\n');

async function testRealClaim(claim, description) {
  console.log(`\n==================================================`);
  console.log(`📋 ${description}`);
  console.log(`🔍 Claim: "${claim}"`);
  console.log(`==================================================\n`);
  
  try {
    // Test the full fact-checking pipeline
    console.log('🔍 Running full fact-check analysis...');
    
    const startTime = Date.now();
    
    // Search for fact-checks
    const factCheckResults = await factChecker.searchFactChecks(claim);
    console.log(`✅ Found ${factCheckResults.length} fact-check results`);
    
    if (factCheckResults.length > 0) {
      console.log('\n📊 Sample Results:');
      factCheckResults.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.publisher}: ${result.rating}`);
        console.log(`     "${result.claim.substring(0, 100)}${result.claim.length > 100 ? '...' : ''}"`);
        console.log(`     ${result.url}`);
      });
    }
    
    // Analyze the results
    console.log('\n🧠 Analyzing results...');
    const analysis = await factChecker.analyzeFactChecks(claim, factCheckResults);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n🎯 FINAL RESULTS:');
    console.log(`   Verdict: ${analysis.verdict}`);
    console.log(`   Confidence: ${analysis.confidence}`);
    console.log(`   Sources: ${factCheckResults.length} fact-check sources`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    
    if (analysis.summary) {
      console.log(`\n📝 Summary: ${analysis.summary.substring(0, 200)}...`);
    }
    
    return analysis;
    
  } catch (error) {
    console.error(`❌ Error testing claim: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

async function runRealTests() {
  console.log('🧪 Testing Real Current Events...\n');
  
  const testCases = [
    {
      claim: "Elon Musk bought CNN for $3 billion",
      description: "REAL TEST 1: Common fake news claim about Elon Musk"
    },
    {
      claim: "COVID-19 vaccines contain microchips",
      description: "REAL TEST 2: Well-documented false conspiracy theory"
    },
    {
      claim: "The moon landing was filmed on a movie set",
      description: "REAL TEST 3: Classic conspiracy theory with extensive fact-checking"
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testRealClaim(testCase.claim, testCase.description);
    results.push({
      claim: testCase.claim,
      result: result
    });
    
    // Add delay between tests to avoid rate limiting
    console.log('\n⏳ Waiting 2 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n==================================================');
  console.log('📊 SUMMARY OF ALL REAL TESTS');
  console.log('==================================================');
  
  results.forEach((test, i) => {
    console.log(`\n${i + 1}. "${test.claim.substring(0, 50)}${test.claim.length > 50 ? '...' : ''}"`);
    if (test.result) {
      console.log(`   ✅ Verdict: ${test.result.verdict} (${test.result.confidence} confidence)`);
    } else {
      console.log(`   ❌ Test failed`);
    }
  });
  
  console.log('\n🎉 Real fact-checking tests completed!');
  console.log('💡 These are the actual verdicts your users will see.');
}

if (require.main === module) {
  runRealTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testRealClaim, runRealTests };
