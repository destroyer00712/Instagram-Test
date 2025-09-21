#!/usr/bin/env node
/**
 * Quick test to verify Google Custom Search API setup
 */

require('dotenv').config();

console.log('🔑 GOOGLE CUSTOM SEARCH API SETUP TEST');
console.log('=' .repeat(50));

// Check environment variables
const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const engineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

console.log('✅ Environment Check:');
console.log('GOOGLE_CUSTOM_SEARCH_API_KEY:', apiKey ? '✅ Present (' + apiKey.length + ' chars)' : '❌ Missing');
console.log('GOOGLE_CUSTOM_SEARCH_ENGINE_ID:', engineId ? '✅ Present (' + engineId.length + ' chars)' : '❌ Missing');
console.log();

if (!apiKey || !engineId) {
    console.log('❌ Missing credentials! Please add to .env:');
    console.log('GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key_here');
    console.log('GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_engine_id_here');
    process.exit(1);
}

// Test API connection
async function testAPIConnection() {
    const axios = require('axios');
    
    try {
        console.log('🔍 Testing Google Custom Search API connection...');
        
        const testQuery = 'test news search';
        const url = 'https://www.googleapis.com/customsearch/v1';
        
        const response = await axios.get(url, {
            params: {
                key: apiKey,
                cx: engineId,
                q: testQuery,
                num: 1
            },
            timeout: 10000
        });
        
        console.log('✅ API Connection: SUCCESS!');
        console.log('📊 Test Results:');
        console.log('- Status:', response.status);
        console.log('- Items returned:', response.data.items?.length || 0);
        console.log('- Search time:', response.data.searchInformation?.searchTime);
        console.log();
        
        if (response.data.items && response.data.items.length > 0) {
            const firstResult = response.data.items[0];
            console.log('🎯 Sample Result:');
            console.log('Title:', firstResult.title?.substring(0, 60) + '...');
            console.log('Source:', firstResult.displayLink);
            console.log();
        }
        
        console.log('🎉 SETUP COMPLETE! Your Google Custom Search API is ready.');
        console.log('');
        console.log('🚀 Next step: Run the fact-checker test:');
        console.log('node test-google-age-detection.js');
        
    } catch (error) {
        console.log('❌ API Connection: FAILED');
        console.log('Error:', error.response?.data?.error?.message || error.message);
        console.log();
        
        if (error.response?.status === 403) {
            console.log('🔧 Common 403 Issues:');
            console.log('1. API Key not enabled for Custom Search API');
            console.log('2. Billing not set up on Google Cloud Project');
            console.log('3. API Key restrictions blocking the request');
            console.log();
            console.log('💡 Solutions:');
            console.log('1. Go to: https://console.developers.google.com/');
            console.log('2. Enable "Custom Search API" for your project');
            console.log('3. Set up billing (free tier available)');
        } else if (error.response?.status === 400) {
            console.log('🔧 Bad Request - Check:');
            console.log('1. Search Engine ID format: should look like "abc123:def456"');
            console.log('2. API Key format: should be a long string');
            console.log('3. Both values copied correctly without extra spaces');
        }
        
        process.exit(1);
    }
}

testAPIConnection().catch(console.error);

