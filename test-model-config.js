#!/usr/bin/env node
require('dotenv').config();

// Test that all required models are properly defined
const factChecker = require('./modules/factChecker');

function testModelConfiguration() {
  console.log('🧪 Testing Model Configuration...\n');
  
  // Read the models from the file
  const fs = require('fs');
  const factCheckerCode = fs.readFileSync('./modules/factChecker.js', 'utf8');
  
  // Extract MODELS object
  const modelsMatch = factCheckerCode.match(/const MODELS = \{([^}]+)\}/);
  
  if (modelsMatch) {
    console.log('📋 Found MODELS configuration:');
    console.log(modelsMatch[0]);
    console.log('');
    
    // Check for required models
    const requiredModels = [
      'CLAIM_ANALYSIS',
      'TRANSCRIPTION', 
      'VISUAL_ANALYSIS',
      'FALLBACK'
    ];
    
    const modelsText = modelsMatch[1];
    
    console.log('🔍 Checking required models:');
    requiredModels.forEach(model => {
      const found = modelsText.includes(model);
      console.log(`   ${found ? '✅' : '❌'} ${model}: ${found ? 'DEFINED' : 'MISSING'}`);
    });
    
    console.log('');
    
    const allFound = requiredModels.every(model => modelsText.includes(model));
    
    if (allFound) {
      console.log('✅ SUCCESS: All required models are properly defined!');
      console.log('🎉 Audio transcription and video analysis should now work!');
    } else {
      console.log('❌ FAILURE: Some required models are missing!');
    }
    
  } else {
    console.log('❌ Could not find MODELS configuration in factChecker.js');
  }
}

testModelConfiguration();
