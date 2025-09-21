#!/usr/bin/env node

// Test message deduplication logic
function testDeduplication() {
  console.log('🧪 Testing Message Deduplication Logic\n');
  
  // Simulate the deduplication system
  const processedMessages = new Set();
  const MESSAGE_CACHE_SIZE = 5; // Small size for testing
  
  function simulateMessage(messageId, content) {
    console.log(`📨 Incoming Message: ${messageId} ("${content}")`);
    
    // Check if already processed (duplicate)
    if (processedMessages.has(messageId)) {
      console.log(`🔄 DUPLICATE IGNORED: ${messageId} (already processed)`);
      console.log(`📊 Cache size: ${processedMessages.size} messages`);
      return false; // Skip processing
    }
    
    // Add to processed set
    processedMessages.add(messageId);
    console.log(`✅ NEW MESSAGE PROCESSED: ${messageId} (cache size: ${processedMessages.size})`);
    
    // Clean cache if full
    if (processedMessages.size > MESSAGE_CACHE_SIZE) {
      console.log(`🧹 Cache full, clearing...`);
      processedMessages.clear();
      processedMessages.add(messageId);
    }
    
    return true; // Process message
  }
  
  console.log('🎯 TESTING SCENARIOS:');
  console.log('');
  
  // Test 1: New messages
  console.log('1. New Messages:');
  simulateMessage('msg_1', 'First reel');
  simulateMessage('msg_2', 'Second reel');
  simulateMessage('msg_3', 'Third reel');
  console.log('');
  
  // Test 2: Duplicate messages (Instagram webhook echo)
  console.log('2. Duplicate Messages (Echo):');
  simulateMessage('msg_1', 'First reel'); // Duplicate!
  simulateMessage('msg_2', 'Second reel'); // Duplicate!
  simulateMessage('msg_4', 'Fourth reel'); // New
  console.log('');
  
  // Test 3: Cache overflow
  console.log('3. Cache Overflow:');
  simulateMessage('msg_5', 'Fifth reel');
  simulateMessage('msg_6', 'Sixth reel'); // Should trigger cleanup
  simulateMessage('msg_7', 'Seventh reel');
  console.log('');
  
  console.log('✅ DEDUPLICATION BENEFITS:');
  console.log('   • Prevents multiple "Processing your reel..." messages');
  console.log('   • Avoids duplicate fact-checking (saves API calls)');
  console.log('   • Eliminates user confusion from echoed responses');
  console.log('   • Memory efficient with automatic cleanup');
  console.log('');
  console.log('🎉 No more duplicate processing!');
}

testDeduplication();
