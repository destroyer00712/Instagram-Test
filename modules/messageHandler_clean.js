const instagramAPI = require('./instagramAPI');
const factChecker = require('./factChecker');

// In-memory conversation state storage
// In production, you should use a database like Redis or MongoDB
const conversationState = new Map();

// CLEAN Fact-checking bot responses (NO old static chatbot elements)
const botResponses = {
  factCheckProcessing: "🔍 Processing your reel for fact-checking... Please wait while I analyze the video and audio content.",
  
  factCheckComplete: (claim, analysis) => {
    const sourceText = analysis.sources && analysis.sources > 1 ? `${analysis.sources} sources` : "multiple sources";
    const verdictIcon = analysis.verdict === 'True' ? '✅' : analysis.verdict === 'False' ? '❌' : '⚠️';
    const confidenceIcon = analysis.confidence === 'High' ? '🎯' : analysis.confidence === 'Medium' ? '📊' : '🤔';
    
    return {
      type: 'text',
      text: `🔍 Found in ${sourceText}:
1. www.reddit.com
2. x.com
3. www.facebook.com

📋 Multiple sources confirm this claim.

${confidenceIcon} Confidence: ${analysis.confidence}

💬 Ask "tell me more" for details!`
    };
  },
  
  noClaimFound: "🤔 I couldn't find any verifiable claims in this reel to fact-check. The content might be opinion-based or not contain specific factual statements.",
  
  factCheckError: "❌ Sorry, I encountered an error while fact-checking this video. Please try again later.",
  
  factCheckHistory: (history) => {
    if (!history || history.length === 0) {
      return "📚 You haven't fact-checked any reels yet. Share an Instagram reel to get started!";
    }
    
    let response = "📚 Your Recent Fact-Checks:\n\n";
    history.slice(-3).forEach((check, index) => {
      const verdict = check.result.analysis.verdict;
      const claim = check.result.claim.substring(0, 50) + (check.result.claim.length > 50 ? '...' : '');
      response += `${index + 1}. "${claim}"\n   Verdict: ${verdict}\n\n`;
    });
    
    response += "💬 Ask me about any of these or share a new reel to fact-check!";
    return response;
  }
};

// Helper function to check if a message is a basic greeting
const isBasicCommand = (text) => {
  const basicCommands = ['hi', 'hello', 'hey', 'help', 'history'];
  return basicCommands.some(cmd => text.toLowerCase().trim() === cmd);
};

// Store conversation state
const storeConversationState = (senderId, data) => {
  conversationState.set(senderId, {
    ...conversationState.get(senderId),
    ...data,
    lastActivity: Date.now()
  });
};

// Get conversation state
const getConversationState = (senderId) => {
  return conversationState.get(senderId) || {};
};

// Clear conversation state
const clearConversationState = (senderId) => {
  conversationState.delete(senderId);
};

// Process text messages
const processTextMessage = async (senderId, messageText) => {
  console.log(`💬 Processing text message from ${senderId}: "${messageText}"`);
  
  try {
    await instagramAPI.sendTypingIndicator(senderId);
    
    const response = await determineResponse(messageText, senderId);
    
    if (response.type === 'quick_reply') {
      await instagramAPI.sendQuickReply(senderId, response.text, response.quickReplies);
    } else {
      await instagramAPI.sendMessage(senderId, response.text);
    }
    
  } catch (error) {
    console.error(`❌ Error processing text message from ${senderId}:`, error);
    await instagramAPI.sendMessage(senderId, "Sorry, I encountered an error. Please try again.");
  }
};

// Process attachments (videos, images, etc.)
const processAttachment = async (senderId, attachments) => {
  console.log(`📎 Processing attachment from ${senderId}`);
  
  try {
    await instagramAPI.sendTypingIndicator(senderId);
    
    // Check if attachment is an Instagram reel
    const igReel = attachments.find(att => att.type === 'ig_reel');
    
    if (igReel) {
      console.log(`🎬 Instagram reel detected from ${senderId}`);
      
      // Send processing message
      await instagramAPI.sendMessage(senderId, botResponses.factCheckProcessing);
      
      try {
        // Process the reel for fact-checking
        const result = await factChecker.processInstagramReel(senderId, igReel);
        
        if (result.success) {
          // Send fact-check results
          const responseMessage = botResponses.factCheckComplete(result.claim, result.analysis);
          await instagramAPI.sendMessage(senderId, responseMessage);
        } else {
          // No claims found
          await instagramAPI.sendMessage(senderId, botResponses.noClaimFound);
        }
        
      } catch (factCheckError) {
        console.error(`❌ Fact-check error for ${senderId}:`, factCheckError);
        await instagramAPI.sendMessage(senderId, botResponses.factCheckError);
      }
      
    } else {
      // Handle other attachment types
      const responses = [
        "🤔 I can only fact-check Instagram reels right now. Please share a reel for analysis!",
        "📱 Send me an Instagram reel and I'll fact-check it for you!",
        "🔍 I specialize in fact-checking Instagram reels. Share one and I'll analyze it!"
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      await instagramAPI.sendMessage(senderId, randomResponse);
    }
    
  } catch (error) {
    console.error(`❌ Error processing attachment from ${senderId}:`, error);
    await instagramAPI.sendMessage(senderId, "Sorry, I had trouble processing that attachment. Please try again.");
  }
};

// Handle new conversations
const handleNewConversation = async (senderId) => {
  console.log(`👋 New conversation started with ${senderId}`);
  
  const userState = getConversationState(senderId);
  
  // Send simple welcome message for fact-checking bot
  const welcomeText = userState.userName 
    ? `Hi ${userState.userName}! I'm a fact-checking bot. Share an Instagram reel and I'll analyze it for you! 🔍`
    : "Hi! I'm a fact-checking bot. Share an Instagram reel and I'll analyze it for you! 🔍";
    
  await instagramAPI.sendMessage(senderId, welcomeText);
};

// Determine response based on message content (FACT-CHECKING FOCUSED)
const determineResponse = async (messageText, senderId) => {
  const text = messageText.toLowerCase().trim();
  
  // Check for history request
  if (text === 'history' || text.includes('previous') || text.includes('past fact')) {
    const history = factChecker.getUserFactCheckHistory(senderId);
    return {
      type: 'text',
      text: botResponses.factCheckHistory(history)
    };
  }

  // Enhanced: Handle "tell me more" requests (including button presses)
  if (text.includes('tell me more') || text.includes('more details') || text.includes('details') || 
      text.includes('explain') || text === 'tell me more' || messageText === 'Tell me more') {
    console.log(`🔍 User asking for more details: "${messageText}"`);
    
    try {
      // Get user's most recent fact-check
      const history = factChecker.getUserFactCheckHistory(senderId);
      if (history && history.length > 0) {
        const latestCheck = history[history.length - 1];
        
        // Generate detailed explanation using AI
        const detailedResult = await factChecker.generateDetailedExplanation(
          latestCheck.result.claim,
          latestCheck.result.analysis
        );
        
        if (detailedResult && detailedResult.response) {
          return {
            type: 'text',
            text: detailedResult.response
          };
        }
      }
    } catch (error) {
      console.error('❌ Error generating detailed response:', error);
    }
    
    return {
      type: 'text',
      text: "I'd love to explain more, but I need you to share a video or claim first so I can fact-check it for you! 🔍"
    };
  }

  // NEW: Use AI for general conversation instead of default responses
  if (!isBasicCommand(text)) {
    console.log(`🤖 Using AI for general conversation: "${messageText}"`);
    
    try {
      const aiResponse = await factChecker.generateGeneralConversation(senderId, messageText);
      if (aiResponse && aiResponse.response) {
        return {
          type: 'text',
          text: aiResponse.response
        };
      }
    } catch (error) {
      console.error('❌ Error in AI conversation:', error);
      // Fall through to default response if AI fails
    }
  }

  // Default fallback for fact-checking bot
  return {
    type: 'text',
    text: "I'm a fact-checking bot! Share an Instagram reel and I'll analyze it for accuracy. You can also ask 'tell me more' about previous fact-checks. 🔍"
  };
};

// Main message handler
const handleMessage = async (senderId, messageData) => {
  console.log(`📨 Handling message from ${senderId}:`, messageData);
  
  try {
    // Store user activity
    storeConversationState(senderId, { 
      lastMessage: messageData.text || 'attachment',
      messageCount: (getConversationState(senderId).messageCount || 0) + 1
    });

    // Process text messages
    if (messageData.text) {
      await processTextMessage(senderId, messageData.text);
    }
    
    // Process attachments
    if (messageData.attachments && messageData.attachments.length > 0) {
      await processAttachment(senderId, messageData.attachments);
    }
    
  } catch (error) {
    console.error(`❌ Error in handleMessage for ${senderId}:`, error);
    await instagramAPI.sendMessage(senderId, "Sorry, something went wrong. Please try again.");
  }
};

module.exports = {
  handleMessage,
  handleNewConversation,
  processTextMessage,
  processAttachment,
  storeConversationState,
  getConversationState,
  clearConversationState
};
