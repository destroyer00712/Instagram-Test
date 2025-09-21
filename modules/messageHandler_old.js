const instagramAPI = require('./instagramAPI');
const factChecker = require('./factChecker');

// In-memory conversation state storage
// In production, you should use a database like Redis or MongoDB
const conversationState = new Map();

// Bot responses configuration
const botResponses = {
  greeting: [
    "Hello! 👋 Welcome to our Instagram chatbot!",
    "Hi there! 😊 How can I help you today?",
    "Hey! Thanks for messaging us. What can I do for you?"
  ],
  
  help: `Here's what I can help you with:
  
🔹 Type "menu" to see all options
🔹 Type "about" to learn more about us
🔹 Type "contact" for contact information
🔹 Type "hours" for business hours
🔹 Type "services" to see our services
🔹 **Share an Instagram reel** and I'll fact-check it for you! 🔍
🔹 Type "history" to see your previous fact-checks 📚
🔹 Type "help" anytime for this message
  
Just send me a message and I'll do my best to help! 😊`,
  
  menu: [
    { title: "About Us", payload: "about" },
    { title: "Services", payload: "services" },
    { title: "Contact", payload: "contact" },
    { title: "Hours", payload: "hours" },
    { title: "Help", payload: "help" }
  ],
  
  about: `We're a friendly business dedicated to providing excellent service! 🌟
  
Our chatbot is here to help you get quick answers to common questions. For more complex inquiries, feel free to reach out to our human team during business hours.
  
Type "contact" for more information on how to reach us directly.`,
  
  contact: `📞 Contact Information:
  
📧 Email: support@yourcompany.com
📱 Phone: (555) 123-4567
🌐 Website: www.yourcompany.com
📍 Address: 123 Business St, City, State 12345
  
We'd love to hear from you! 😊`,
  
  hours: `🕐 Business Hours:
  
Monday - Friday: 9:00 AM - 6:00 PM
Saturday: 10:00 AM - 4:00 PM
Sunday: Closed
  
Our chatbot is available 24/7 for basic questions! 🤖`,
  
  services: `🛍️ Our Services:
  
✅ Service 1: Description here
✅ Service 2: Description here
✅ Service 3: Description here
✅ Service 4: Description here
  
Want to learn more about any specific service? Just ask! 😊`,
  
  default: [
    "I'm here to help you fact-check news! 📰 Send me an Instagram reel or ask about a claim you'd like me to verify.",
    "Not sure what you're asking? I specialize in fact-checking videos and news claims. Try sending me a reel! 🔍",
    "I can verify facts from videos and news! Send me content to analyze, or type 'help' to learn more. 🤖",
    "Looking to fact-check something? Share an Instagram reel with me and I'll analyze it with trusted sources! ✅"
  ],
  
  thanks: [
    "You're welcome! 😊 Is there anything else I can help you with?",
    "Happy to help! Let me know if you need anything else! 🌟",
    "Glad I could assist! Feel free to ask if you have more questions! 👍"
  ],
  
  factCheckProcessing: "🔍 I'm analyzing this video for fact-checking. This may take a moment...",
  
  factCheckComplete: (claim, analysis) => {
    // INSTAGRAM CHARACTER LIMIT: 1,000 characters max - keep it concise!
    
    // Start with verdict emoji and short intro
    let message = '';
    switch (analysis.verdict) {
      case 'True':
        message = `✅ **VERIFIED** `;
        break;
      case 'False':
        message = `❌ **FALSE** `;
        break;
      case 'Mixed':
        message = `⚖️ **MIXED** `;
        break;
      default:
        message = `🤔 **UNCLEAR** `;
    }
    
    // Add claim (truncated if too long)
    const shortClaim = claim.length > 80 ? claim.substring(0, 77) + '...' : claim;
    message += `"${shortClaim}"\n\n`;
    
    // PRIORITY: Use Google search results (95% weight as requested)
    if (analysis.googleSearchSummary) {
      message += analysis.googleSearchSummary;
    } else {
      // Extract Google search info from analysis
      const googleSources = [];
      let explanation = '';
      
      // Get Google search results and create explanation
      if (analysis.sources && analysis.sources.length > 0) {
        // Find Google search sources
        const allSources = analysis.sources.filter(s => s.sourceType === 'google_search' || !s.sourceType);
        const topSources = allSources.slice(0, 3);
        
        if (topSources.length > 0) {
          message += `🔍 Found in ${topSources.length} sources:\n`;
          topSources.forEach((source, i) => {
            const sourceName = source.publisherSite || source.publisher || 'Unknown';
            message += `${i + 1}. ${sourceName}\n`;
          });
          
          // Add simple explanation based on verdict
          message += `\n📋 `;
          switch (analysis.verdict) {
            case 'False':
              message += `Multiple sources contradict this claim.`;
              break;
            case 'True':
              message += `Multiple sources confirm this claim.`;
              break;
            case 'Mixed':
              message += `Sources show mixed evidence on this claim.`;
              break;
            default:
              message += `Limited evidence available on this claim.`;
          }
        }
      }
    }
    
    message += `\n\n🎯 Confidence: ${analysis.confidence}`;
    
    // Add closing if space allows
    const currentLength = message.length;
    if (currentLength < 900) {
      message += `\n\n💬 Ask "tell me more" for details!`;
    }
    
    // Final safety check - truncate if still too long
    if (message.length > 990) {
      message = message.substring(0, 987) + '...';
    }
    
    return message;
  },
  
  factCheckError: "❌ Sorry, I encountered an error while fact-checking this video. Please try again later.",
  
  noClaimFound: "🤔 I couldn't find any specific claims to fact-check in this video. Try sharing a video with more specific factual statements.",
  
  factCheckHistory: (history) => {
    if (!history || history.length === 0) {
      return "📚 You don't have any fact-check history yet. Share a video with claims and I'll help you verify them!";
    }
    
    let message = `📚 **Your Fact-Check History**\n\n`;
    const recentChecks = history.slice(-5); // Show last 5
    
    recentChecks.forEach((check, index) => {
      const date = new Date(check.timestamp).toLocaleDateString();
      message += `${index + 1}. **${check.result.claim}**\n`;
      message += `   Verdict: ${check.result.analysis.verdict}\n`;
      message += `   Date: ${date}\n\n`;
    });
    
    if (history.length > 5) {
      message += `...and ${history.length - 5} more fact-checks.`;
    }
    
    return message;
  }
};

/**
 * Process incoming text message
 */
const processMessage = async (senderId, messageText, timestamp) => {
  console.log(`🧠 Processing message from ${senderId}: "${messageText}"`);
  
  try {
    // Send typing indicator
    await instagramAPI.sendTypingIndicator(senderId);
    
    // Get or create conversation state
    let userState = conversationState.get(senderId) || {
      isNewUser: true,
      messageCount: 0,
      lastMessageTime: null,
      userName: null
    };
    
    // Update conversation state
    userState.messageCount++;
    userState.lastMessageTime = timestamp;
    conversationState.set(senderId, userState);
    
    // Handle new user
    if (userState.isNewUser) {
      await handleNewUser(senderId, userState);
      userState.isNewUser = false;
      conversationState.set(senderId, userState);
    }
    
    // Process the message based on content
    const response = await generateResponse(messageText, userState, senderId);
    
    // Add small delay to simulate human-like response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send response
    if (response.type === 'text') {
      await instagramAPI.sendMessage(senderId, response.text);
    } else if (response.type === 'quick_reply') {
      await instagramAPI.sendQuickReply(senderId, response.text, response.quickReplies);
    }
    
    console.log(`✅ Response sent to ${senderId}`);
    
  } catch (error) {
    console.error(`❌ Error processing message from ${senderId}:`, error);
    await handleError(senderId, error);
  }
};

/**
 * Process attachment messages
 */
const processAttachment = async (senderId, attachments, timestamp) => {
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
        "Thanks for sharing that! 📸",
        "I can see you've sent me something. For fact-checking, please share Instagram reels with claims you'd like me to verify! 🔍",
        "Nice! If you want me to fact-check content, share an Instagram reel and I'll analyze it for you! 🤖"
      ];
      
      const response = responses[Math.floor(Math.random() * responses.length)];
      await instagramAPI.sendMessage(senderId, response);
    }
    
  } catch (error) {
    console.error(`❌ Error processing attachment from ${senderId}:`, error);
    await handleError(senderId, error);
  }
};

/**
 * Handle new user
 */
const handleNewUser = async (senderId, userState) => {
  console.log(`🆕 New user: ${senderId}`);
  
  try {
    // Try to get user profile
    const userProfile = await instagramAPI.getUserProfile(senderId);
    if (userProfile && userProfile.name) {
      userState.userName = userProfile.name;
    }
  } catch (error) {
    console.log('Could not fetch user profile:', error.message);
  }
  
  // Send welcome message
  const welcomeText = userState.userName 
    ? `Hello ${userState.userName}! ${getRandomResponse(botResponses.greeting)}`
    : getRandomResponse(botResponses.greeting);
  
  await instagramAPI.sendMessage(senderId, welcomeText);
  
  // Send menu after welcome
  setTimeout(async () => {
    await instagramAPI.sendQuickReply(
      senderId,
      "Here's what I can help you with:",
      botResponses.menu
    );
  }, 2000);
};

/**
 * Generate response based on message content
 */
const generateResponse = async (messageText, userState, senderId) => {
  const text = messageText.toLowerCase().trim();
  
  // Keyword matching
  if (isGreeting(text)) {
    return {
      type: 'text',
      text: getRandomResponse(botResponses.greeting)
    };
  }
  
  if (isThankYou(text)) {
    return {
      type: 'text',
      text: getRandomResponse(botResponses.thanks)
    };
  }
  
  if (text.includes('help') || text.includes('assist')) {
    return {
      type: 'text',
      text: botResponses.help
    };
  }
  
  if (text.includes('menu') || text.includes('options')) {
    return {
      type: 'quick_reply',
      text: "Here are your options:",
      quickReplies: botResponses.menu
    };
  }
  
  if (text.includes('about') || text.includes('who are you') || text.includes('company')) {
    return {
      type: 'text',
      text: botResponses.about
    };
  }
  
  if (text.includes('contact') || text.includes('phone') || text.includes('email') || text.includes('reach')) {
    return {
      type: 'text',
      text: botResponses.contact
    };
  }
  
  if (text.includes('hours') || text.includes('open') || text.includes('closed') || text.includes('time')) {
    return {
      type: 'text',
      text: botResponses.hours
    };
  }
  
  if (text.includes('service') || text.includes('product') || text.includes('offer')) {
    return {
      type: 'text',
      text: botResponses.services
    };
  }
  
  // Enhanced fact-check history with simple listing
  if (text.includes('fact-check') || text.includes('factcheck') || text.includes('history') || text.includes('previous')) {
    const history = factChecker.getUserFactCheckHistory(senderId);
    return {
      type: 'text',
      text: botResponses.factCheckHistory(history)
    };
  }
  
  // Special handling for "tell me more" requests even without history
  if (text.includes('tell me more') || text.includes('more details') || text.includes('elaborate')) {
    const history = factChecker.getUserFactCheckHistory(senderId);
    
    if (!history || history.length === 0) {
      console.log(`💬 "Tell me more" request but no history - providing helpful guidance`);
      return {
        type: 'text',
        text: `I'd love to tell you more! 😊 

I'm a fact-checking bot that analyzes Instagram reels and videos. Send me any video with a claim or news story, and I'll:

✅ **Verify the facts** using trusted sources
✅ **Show you the evidence** with high confidence ratings  
✅ **Give clear TRUE/FALSE verdicts** instead of vague answers
✅ **Use 95% Google search weighting** for accurate results

Try sending me a reel now, and then you can ask "tell me more" about the results! 🔍📱`
      };
    }
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

  // NEW: Conversational memory search for news/content questions
  if (await shouldSearchMemory(text, senderId)) {
    console.log(`🧠 Detected potential memory query: "${messageText}"`);
    
    try {
      // Search user's fact-check memory
      const relevantChecks = await factChecker.searchFactCheckMemory(senderId, messageText);
      
      if (relevantChecks && relevantChecks.length > 0) {
        // Generate conversational response
        const conversationalResult = await factChecker.generateConversationalResponse(
          senderId, 
          messageText, 
          relevantChecks
        );
        
        if (conversationalResult.found) {
          console.log(`✅ Generated conversational response about previous fact-checks`);
          return {
            type: 'text',
            text: conversationalResult.response
          };
        }
      }
    } catch (error) {
      console.error('❌ Error in memory search:', error);
      // Fall through to AI response if memory search fails
    }
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
  
  // Default response (fallback)
  return {
    type: 'text',
    text: getRandomResponse(botResponses.default)
  };
};

/**
 * Determine if we should search memory for this message
 */
const shouldSearchMemory = async (text, senderId) => {
  // First check if user has any fact-check history
  const history = factChecker.getUserFactCheckHistory(senderId);
  if (!history || history.length === 0) {
    return false;
  }
  
  // Quick keyword filters - definitely search memory for these
  const memoryKeywords = [
    'tell me more', 'more details', 'more info', 'elaborate', 'expand',
    'remember', 'recall', 'before', 'earlier', 'previous', 'last time',
    'that thing', 'that story', 'that claim', 'that news', 'that video',
    'what about', 'tell me about', 'explain', 'more about', 'details about',
    'full story', 'complete details', 'further information'
  ];
  
  if (memoryKeywords.some(keyword => text.includes(keyword))) {
    console.log(`🎯 Memory search triggered by keyword: "${text}"`);
    return true;
  }
  
  // Don't search for basic commands/responses
  const skipKeywords = [
    'hello', 'hi', 'help', 'menu', 'about', 'contact', 'hours', 'services',
    'thank', 'thanks', 'yes', 'no', 'ok', 'okay'
  ];
  
  if (skipKeywords.some(keyword => text.includes(keyword))) {
    return false;
  }
  
  // For longer messages (5+ words), likely asking about content
  const words = text.split(' ').filter(word => word.length > 2);
  if (words.length >= 5) {
    console.log(`🤔 Long message detected, checking for content questions: "${text}"`);
    
    // Look for question patterns
    const questionPatterns = [
      /what (is|was|about|happened)/,
      /how (did|does|is|was)/,
      /why (did|does|is|was)/,
      /when (did|does|is|was)/,
      /where (did|does|is|was)/,
      /who (is|was|did)/,
      /can you (tell|explain|share)/,
      /(true|false|real|fake)/,
      /(news|story|claim|report)/
    ];
    
    if (questionPatterns.some(pattern => pattern.test(text))) {
      console.log(`❓ Question pattern detected, searching memory`);
      return true;
    }
  }
  
  return false;
};

/**
 * Check if message is a greeting
 */
const isGreeting = (text) => {
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'hola', 'howdy'];
  return greetings.some(greeting => text.includes(greeting));
};

/**
 * Check if message is a thank you
 */
const isThankYou = (text) => {
  const thankYou = ['thank', 'thanks', 'appreciate', 'grateful', 'thx'];
  return thankYou.some(thanks => text.includes(thanks));
};

/**
 * Check if message is a basic command that shouldn't use AI
 */
const isBasicCommand = (text) => {
  const basicCommands = [
    'hello', 'hi', 'hey', 'help', 'menu', 'about', 'contact', 
    'hours', 'services', 'thank', 'thanks', 'yes', 'no', 'ok', 'okay'
  ];
  return basicCommands.some(command => text.includes(command));
};

/**
 * Get random response from array
 */
const getRandomResponse = (responses) => {
  if (Array.isArray(responses)) {
    return responses[Math.floor(Math.random() * responses.length)];
  }
  return responses;
};

/**
 * Handle errors
 */
const handleError = async (senderId, error) => {
  console.error(`❌ Handling error for ${senderId}:`, error.message);
  
  try {
    const errorMessage = "Sorry, I encountered an error. Please try again later or contact our support team if the issue persists. 🤖";
    await instagramAPI.sendMessage(senderId, errorMessage);
  } catch (sendError) {
    console.error('❌ Error sending error message:', sendError.message);
  }
};

/**
 * Get conversation state for a user
 */
const getConversationState = (senderId) => {
  return conversationState.get(senderId);
};

/**
 * Clear conversation state for a user
 */
const clearConversationState = (senderId) => {
  conversationState.delete(senderId);
};

module.exports = {
  processMessage,
  processAttachment,
  getConversationState,
  clearConversationState,
  botResponses // Export for testing
}; 