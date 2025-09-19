#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

/**
 * Setup script for Instagram Fact-Checker Bot
 * This script creates necessary directories and validates the environment
 */

async function setup() {
  console.log('🚀 Setting up Instagram Fact-Checker Bot...\n');
  
  try {
    // Create necessary directories
    console.log('📁 Creating directories...');
    const directories = [
      'temp',
      'temp/videos',
      'temp/audio'
    ];
    
    for (const dir of directories) {
      await fs.ensureDir(dir);
      console.log(`✅ Created: ${dir}`);
    }
    
    // Check for .env file
    console.log('\n🔍 Checking environment configuration...');
    const envExists = await fs.pathExists('.env');
    
    if (!envExists) {
      console.log('⚠️  .env file not found. Please copy config.template to .env and fill in your API keys.');
      console.log('📋 Required environment variables:');
      console.log('   - INSTAGRAM_ACCESS_TOKEN');
      console.log('   - GEMINI_API_KEY');
      console.log('   - GOOGLE_FACTCHECK_API_KEY');
      console.log('   - WEBHOOK_VERIFY_TOKEN');
      console.log('   - WEBHOOK_SECRET');
      console.log('   - INSTAGRAM_ACCOUNT_ID');
    } else {
      console.log('✅ .env file found');
      
      // Validate required environment variables
      require('dotenv').config();
      
      const requiredVars = [
        'INSTAGRAM_ACCESS_TOKEN',
        'GEMINI_API_KEY',
        'GOOGLE_FACTCHECK_API_KEY',
        'WEBHOOK_VERIFY_TOKEN',
        'WEBHOOK_SECRET',
        'INSTAGRAM_ACCOUNT_ID'
      ];
      
      const missing = requiredVars.filter(varName => !process.env[varName]);
      
      if (missing.length > 0) {
        console.log('❌ Missing environment variables:');
        missing.forEach(varName => console.log(`   - ${varName}`));
      } else {
        console.log('✅ All required environment variables are set');
      }
    }
    
    // Check for FFmpeg
    console.log('\n🎥 Checking FFmpeg installation...');
    try {
      const { execSync } = require('child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      console.log('✅ FFmpeg is installed');
    } catch (error) {
      console.log('❌ FFmpeg not found. Please install FFmpeg for video processing:');
      console.log('   macOS: brew install ffmpeg');
      console.log('   Ubuntu: sudo apt install ffmpeg');
      console.log('   Windows: Download from https://ffmpeg.org/download.html');
    }
    
    console.log('\n🎉 Setup completed!');
    console.log('\n📖 Next steps:');
    console.log('1. Copy config.template to .env and fill in your API keys');
    console.log('2. Ensure FFmpeg is installed for video processing');
    console.log('3. Run "npm start" to start the bot');
    console.log('\n💡 Features:');
    console.log('- Share Instagram reels to fact-check claims');
    console.log('- Get detailed analysis with sources');
    console.log('- View your fact-check history');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setup();
}

module.exports = { setup };
