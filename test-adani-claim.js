#!/usr/bin/env node

// Load environment variables FIRST
require('dotenv').config();

const factChecker = require('./modules/factChecker');

console.log('🔑 Initializing Gemini AI...');
console.log('🚀 Testing ADANI LAND PURCHASE CLAIM\n');

async function testAdaniClaim() {
  const claim = "Adani bought land for 1 rupee";
  
  console.log(`==================================================`);
  console.log(`📋 REAL NEWS TEST: Adani Land Purchase`);
  console.log(`🔍 Claim: "${claim}"`);
  console.log(`🎯 This should find real news articles about this topic`);
  console.log(`==================================================\n`);
  
  try {
    const startTime = Date.now();
    
    // Test the integrated fact-checking system
    console.log('🔍 Using full fact-checking pipeline...');
    const factCheckResults = await factChecker.searchFactChecks(claim);
    
    console.log(`✅ Found ${factCheckResults.length} fact-check results`);
    
    if (factCheckResults.length > 0) {
      console.log('\n📊 Sample Results:');
      factCheckResults.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.publisher}: ${result.rating}`);
        if (result.aiAnalysis) {
          console.log(`     AI Analysis: ${result.aiAnalysis.verdict} (${result.aiAnalysis.confidence} confidence)`);
        }
        console.log(`     "${result.title}"`);
        console.log(`     ${result.url}`);
      });
    }
    
    // Analyze the results
    console.log('\n🧠 Analyzing results...');
    const analysis = await factChecker.analyzeFactChecks(factCheckResults, claim);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n🎯 FINAL RESULTS:');
    console.log(`   Verdict: ${analysis.verdict}`);
    console.log(`   Confidence: ${analysis.confidence}`);
    console.log(`   Sources: ${factCheckResults.length} sources analyzed`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    
    if (analysis.summary) {
      console.log(`\n📝 Summary: ${analysis.summary}`);
    }
    
    // Show what sources were found
    if (analysis.sources && analysis.sources.length > 0) {
      console.log(`\n📰 Sources Found:`);
      analysis.sources.forEach((source, i) => {
        console.log(`   ${i + 1}. ${source.publisher}`);
        if (source.aiVerdict) {
          console.log(`      AI says: ${source.aiVerdict}`);
        }
      });
    }
    
    return {
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      sourcesFound: factCheckResults.length,
      duration: duration
    };
    
  } catch (error) {
    console.error(`❌ Error testing Adani claim: ${error.message}`);
    console.error(error.stack);
    return {
      error: error.message,
      verdict: 'Error'
    };
  }
}

// Also test with more specific variations
async function testAdaniVariations() {
  const variations = [
    "Adani bought land for 1 rupee",
    "Adani Group purchased land for one rupee",  
    "Adani acquired government land for 1 rupee"
  ];
  
  console.log('\n🔄 Testing multiple variations of the Adani claim...\n');
  
  const results = [];
  
  for (let i = 0; i < variations.length; i++) {
    const claim = variations[i];
    console.log(`\n${i + 1}. Testing: "${claim}"`);
    console.log('=' + '='.repeat(60));
    
    try {
      // Quick test with direct Google search
      const axios = require('axios');
      const searchUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = {
        key: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
        cx: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
        q: `"${claim}" OR "Adani 1 rupee land" news`,
        num: 3,
        tbm: 'nws'
      };
      
      console.log(`🔍 Quick Google search for: "${claim}"`);
      const response = await axios.get(searchUrl, { params, timeout: 10000 });
      
      if (response.data.items && response.data.items.length > 0) {
        console.log(`✅ Found ${response.data.items.length} news articles`);
        
        response.data.items.forEach((item, j) => {
          console.log(`   ${j + 1}. ${item.title}`);
          console.log(`      ${item.link}`);
          console.log(`      ${item.snippet?.substring(0, 100)}...`);
        });
        
        results.push({
          claim: claim,
          found: true,
          count: response.data.items.length
        });
        
      } else {
        console.log(`❌ No news articles found`);
        results.push({
          claim: claim, 
          found: false,
          count: 0
        });
      }
      
    } catch (error) {
      console.log(`❌ Search error: ${error.message}`);
      results.push({
        claim: claim,
        found: false,
        error: error.message
      });
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n📊 SUMMARY OF ADANI CLAIM VARIATIONS:');
  results.forEach((result, i) => {
    console.log(`${i + 1}. "${result.claim}"`);
    if (result.found) {
      console.log(`   ✅ Found ${result.count} articles`);
    } else {
      console.log(`   ❌ No articles found${result.error ? ' (Error: ' + result.error + ')' : ''}`);
    }
  });
}

async function runAdaniTest() {
  console.log('🧪 Testing Adani Land Purchase Claim...\n');
  
  // First, test the main claim
  const mainResult = await testAdaniClaim();
  
  // Then test variations to see what's available
  await testAdaniVariations();
  
  console.log('\n🏁 Adani claim testing completed');
  console.log(`📊 Main result: ${mainResult.verdict || 'Error'} (${mainResult.sourcesFound || 0} sources)`);
}

if (require.main === module) {
  runAdaniTest().catch(error => {
    console.error('❌ Adani test failed:', error);
    process.exit(1);
  });
}
