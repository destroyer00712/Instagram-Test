#!/usr/bin/env node

/**
 * Simple test script to verify Gemini API key is working
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiKey() {
  console.log('🧪 Testing Gemini API Key...\n');
  
  // Log environment info
  console.log('🔧 Environment Debug:');
  console.log('🔧 NODE_ENV:', process.env.NODE_ENV || 'undefined');
  console.log('🔧 GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
  console.log('🔧 GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined');
  console.log('🔧 GEMINI_API_KEY preview:', process.env.GEMINI_API_KEY ? 
    process.env.GEMINI_API_KEY.substring(0, 15) + '...' + process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 15) 
    : 'undefined');
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
  }
  
  try {
    console.log('\n🚀 Initializing Gemini AI...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    console.log('🤖 Testing with gemini-2.0-flash-exp model...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    console.log('📤 Sending test prompt...');
    const result = await model.generateContent('Hello, this is a test. Please respond with "API key working".');
    
    const response = result.response.text();
    console.log('📥 Response received:', response);
    console.log('✅ Gemini API key is working correctly!\n');
    
    // Test with Pro model
    console.log('🤖 Testing with gemini-1.5-pro model...');
    const proModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    console.log('📤 Sending test prompt to Pro model...');
    const proResult = await proModel.generateContent('Hello, this is a test. Please respond with "Pro API key working".');
    
    const proResponse = proResult.response.text();
    console.log('📥 Pro Response received:', proResponse);
    console.log('✅ Gemini Pro API key is working correctly!\n');
    
    // Test with 2.0 Flash model
    console.log('🤖 Testing with gemini-2.0-flash-exp model...');
    const flash2Model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    console.log('📤 Sending test prompt to 2.0 Flash model...');
    const flash2Result = await flash2Model.generateContent('Hello, this is a test. Please respond with "2.0 Flash API key working".');
    
    const flash2Response = flash2Result.response.text();
    console.log('📥 2.0 Flash Response received:', flash2Response);
    console.log('✅ Gemini 2.0 Flash API key is working correctly!\n');
    
  } catch (error) {
    console.log('❌ Gemini API key test failed:');
    console.log('Error:', error.message);
    
    if (error.message && error.message.includes('quota')) {
      console.log('\n🔍 Quota Error Details:');
      console.log('- This indicates the API key has exceeded its usage limits');
      console.log('- Check your Google AI Studio quota: https://aistudio.google.com/');
      console.log('- You may need to wait for the quota to reset or upgrade your plan');
    } else if (error.message && error.message.includes('API key')) {
      console.log('\n🔍 API Key Error Details:');
      console.log('- The API key appears to be invalid or malformed');
      console.log('- Check your .env file and ensure GEMINI_API_KEY is correct');
      console.log('- Get a new key from: https://aistudio.google.com/');
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  testGeminiKey();
}

module.exports = { testGeminiKey };
