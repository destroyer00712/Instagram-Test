#!/usr/bin/env node
require('dotenv').config();
const factChecker = require('./modules/factChecker');

async function quickTest() {
  console.log('🚀 Quick Test: Adani Land Claim\n');
  
  try {
    const results = await factChecker.searchFactChecks("Adani bought land for 1 rupee");
    const analysis = await factChecker.analyzeFactChecks(results, "Adani bought land for 1 rupee");
    
    console.log(`\n🎯 RESULT: ${analysis.verdict} (${analysis.confidence})`);
    console.log(`📝 ${analysis.summary}`);
    
    if (analysis.verdict === 'True') {
      console.log('✅ SUCCESS: Correctly identified as TRUE');
    } else if (analysis.verdict === 'False') {
      console.log('❌ Marked as FALSE - might need adjustment');
    } else {
      console.log('⚠️ UNCLEAR/UNKNOWN - system is being too cautious');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();
