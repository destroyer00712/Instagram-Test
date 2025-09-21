#!/usr/bin/env node

/**
 * API Environment Test - Debug API key loading
 */

// Try different environment loading approaches
console.log('🔧 API ENVIRONMENT DEBUGGING');
console.log('=' .repeat(50));

console.log('\n1. BEFORE DOTENV LOADING:');
console.log(`   GEMINI_API_KEY exists: ${!!process.env.GEMINI_API_KEY}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);

// Try loading .env file
try {
    require('dotenv').config();
    console.log('\n2. AFTER DOTENV LOADING:');
    console.log(`   ✅ dotenv loaded successfully`);
    console.log(`   GEMINI_API_KEY exists: ${!!process.env.GEMINI_API_KEY}`);
    console.log(`   GEMINI_API_KEY length: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined'}`);
    
    if (process.env.GEMINI_API_KEY) {
        const key = process.env.GEMINI_API_KEY;
        console.log(`   GEMINI_API_KEY preview: ${key.substring(0, 10)}...${key.substring(key.length - 10)}`);
        console.log(`   ✅ API key loaded successfully!`);
    } else {
        console.log(`   ❌ GEMINI_API_KEY still not loaded`);
    }
} catch (error) {
    console.log('\n2. DOTENV LOADING FAILED:');
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   💡 Suggestion: Run "npm install dotenv"`);
}

console.log('\n3. ENVIRONMENT FILE CHECK:');
const fs = require('fs');
const path = require('path');

const envFiles = ['.env', '.env.local', '.env.production'];
envFiles.forEach(filename => {
    const filePath = path.join(process.cwd(), filename);
    const exists = fs.existsSync(filePath);
    console.log(`   ${filename}: ${exists ? '✅ Found' : '❌ Missing'}`);
});

console.log('\n4. QUICK API TEST (if key available):');
if (process.env.GEMINI_API_KEY) {
    console.log(`   🧪 Testing with actual factChecker module...`);
    try {
        const factChecker = require('./modules/factChecker');
        console.log(`   ✅ FactChecker module loaded successfully`);
        console.log(`   🎯 Ready for live testing with actual API calls`);
    } catch (error) {
        console.log(`   ❌ FactChecker loading error: ${error.message}`);
    }
} else {
    console.log(`   ⚠️  No API key available for testing`);
    console.log(`   💡 Add GEMINI_API_KEY to .env file to enable live testing`);
}

console.log('\n🎯 NEXT STEPS:');
if (process.env.GEMINI_API_KEY) {
    console.log(`   ✅ Environment is ready!`);
    console.log(`   🚀 Run actual Reddit age detection tests:`);
    console.log(`      node -e "require('./modules/factChecker').searchRedditForClaimAge('Charlie Kirk assassination').then(console.log)"`);
} else {
    console.log(`   🔧 To enable live testing:`);
    console.log(`   1. Create .env file in project root`);
    console.log(`   2. Add: GEMINI_API_KEY=your_actual_api_key_here`);
    console.log(`   3. Re-run this test`);
}

console.log('=' .repeat(50));
