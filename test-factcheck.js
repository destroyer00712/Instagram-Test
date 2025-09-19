#!/usr/bin/env node

/**
 * Test script for the fact-checking functionality
 * This script allows you to test the fact-checker without Instagram webhooks
 */

require('dotenv').config();
const factChecker = require('./modules/factChecker');

// Test Instagram reel data (similar to what webhooks receive)
const testReelData = {
  type: "ig_reel",
  payload: {
    reel_video_id: "18534719050004022",
    title: "Ganpati Bappa Morya ❤️🔥\n.\n.\n#ganpati #ganpatibappa #ganpatibappamorya #reels #officereels #entertainment #funny #explore #viralreels #office #comedy #funnyreels",
    url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18534719050004022&signature=AYejCG8o4x0YEdLvDaA04i_JdpeKKTsspF5lLXm__v4Psf5SVyf2yZ033klZR_ai2VFuvXp4K9j65CB2iZ0ox8Cd6Lg4m8i_gXYSj6vfNtsLpw_pULm_9lfDfbdzS2WqadpYCJfyZ60ad7KlNvd_4LjXrPODyqtiOybHzqxue9MlzUkGnWPy_ECWNO13IGLgeknVyTydSC4UZHpacva6UZw_DbmNHys_"
  }
};

// Test claim for fact-checking API
const testClaim = "Is Charlie Kirk dead";

async function testEnvironment() {
  console.log('🧪 Testing Environment Setup...\n');
  
  // Check required environment variables
  const requiredVars = [
    'GEMINI_API_KEY',
    'GOOGLE_FACTCHECK_API_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:');
    missing.forEach(varName => console.log(`   - ${varName}`));
    console.log('\nPlease set these in your .env file before testing.');
    return false;
  }
  
  console.log('✅ All required environment variables are set\n');
  return true;
}

async function testFactCheckAPI() {
  console.log('🔍 Testing Fact Check API...\n');
  
  try {
    console.log(`Searching for: "${testClaim}"`);
    const results = await factChecker.searchFactChecks(testClaim);
    
    if (results.claims && results.claims.length > 0) {
      console.log(`✅ Found ${results.claims.length} fact-check results`);
      
      // Show first result
      const firstClaim = results.claims[0];
      console.log('\n📋 Sample Result:');
      console.log(`  Claim: ${firstClaim.text}`);
      
      if (firstClaim.claimReview && firstClaim.claimReview.length > 0) {
        const review = firstClaim.claimReview[0];
        console.log(`  Publisher: ${review.publisher?.name || 'Unknown'}`);
        console.log(`  Rating: ${review.textualRating || 'N/A'}`);
        console.log(`  URL: ${review.url || 'N/A'}`);
      }
    } else {
      console.log('⚠️  No fact-check results found for this claim');
    }
    
    console.log('\n✅ Fact Check API test completed\n');
    
  } catch (error) {
    console.log('❌ Fact Check API test failed:', error.message);
    console.log('   Check your GOOGLE_FACTCHECK_API_KEY\n');
  }
}

async function testClaimExtraction() {
  console.log('🧠 Testing Enhanced Claim Extraction (using Gemini 1.5 Pro)...\n');
  
  try {
    // Test multiple scenarios for better validation
    const testCases = [
      {
        transcription: "Charlie Kirk, the conservative activist, was tragically shot and killed yesterday during a public event.",
        caption: "Breaking news about Charlie Kirk #news #politics",
        expected: "Should extract a factual claim about Charlie Kirk"
      },
      {
        transcription: "I think this policy is really bad and the government should change it because it's not working well.",
        caption: "My opinion on current policy #opinion #politics",
        expected: "Should return 'No verifiable claim found' for opinion"
      },
      {
        transcription: "According to recent studies, 75% of Americans support the new healthcare policy.",
        caption: "Healthcare statistics #data #healthcare",
        expected: "Should extract statistical claim"
      }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n📋 Test Case ${i + 1}: ${testCase.expected}`);
      console.log(`Transcription: "${testCase.transcription}"`);
      console.log(`Caption: "${testCase.caption}"`);
      
      const claim = await factChecker.extractClaim(testCase.transcription, testCase.caption);
      console.log(`✅ Result: "${claim}"`);
      
      // Add small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n✅ Enhanced claim extraction test completed\n');
    
  } catch (error) {
    console.log('❌ Claim extraction test failed:', error.message);
    console.log('   Check your GEMINI_API_KEY and ensure you have access to Gemini 1.5 Pro\n');
  }
}

async function testAnalysis() {
  console.log('📊 Testing Fact-Check Analysis...\n');
  
  // Sample fact-check results (like what would come from Google API)
  const sampleResults = {
    claims: [
      {
        text: "Charlie Kirk was fatally shot",
        claimReview: [
          {
            publisher: { name: "AP News" },
            url: "https://apnews.com/article/example",
            title: "Fact Check: Charlie Kirk shooting claims",
            textualRating: "False",
            reviewDate: "2025-09-19T10:00:00Z"
          }
        ]
      },
      {
        text: "Conservative activist Charlie Kirk killed",
        claimReview: [
          {
            publisher: { name: "Snopes" },
            url: "https://snopes.com/fact-check/example",
            title: "Did Charlie Kirk die?",
            textualRating: "False",
            reviewDate: "2025-09-19T11:00:00Z"
          }
        ]
      }
    ]
  };
  
  try {
    const analysis = factChecker.analyzeFactChecks(sampleResults);
    
    console.log('Analysis Results:');
    console.log(`  Verdict: ${analysis.verdict}`);
    console.log(`  Confidence: ${analysis.confidence}`);
    console.log(`  Summary: ${analysis.summary}`);
    console.log(`  Sources: ${analysis.sources.length}`);
    
    analysis.sources.forEach((source, index) => {
      console.log(`    ${index + 1}. ${source.publisher} - ${source.rating}`);
    });
    
    console.log('✅ Analysis test completed\n');
    
  } catch (error) {
    console.log('❌ Analysis test failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Fact-Checker Test Suite\n');
  console.log('=' .repeat(50));
  
  const envOk = await testEnvironment();
  if (!envOk) {
    return;
  }
  
  // Test individual components
  await testFactCheckAPI();
  await testClaimExtraction();
  await testAnalysis();
  
  console.log('=' .repeat(50));
  console.log('🎉 Test Suite Completed!\n');
  
  console.log('💡 Next Steps:');
  console.log('1. Set up Instagram webhook to receive real reel data');
  console.log('2. Share an Instagram reel with your bot');
  console.log('3. Check server logs to see the full processing pipeline');
  console.log('\n📖 See README.md for full setup instructions');
}

// Allow running specific tests
const testType = process.argv[2];

switch (testType) {
  case 'env':
    testEnvironment();
    break;
  case 'api':
    testEnvironment().then(ok => {
      if (ok) testFactCheckAPI();
    });
    break;
  case 'claims':
    testEnvironment().then(ok => {
      if (ok) testClaimExtraction();
    });
    break;
  case 'analysis':
    testAnalysis();
    break;
  default:
    runAllTests();
}

module.exports = {
  testEnvironment,
  testFactCheckAPI,
  testClaimExtraction,
  testAnalysis
};
