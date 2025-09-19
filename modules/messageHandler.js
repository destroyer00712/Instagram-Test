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
    "I'm not sure I understand. Could you try rephrasing that?",
    "Hmm, I didn't catch that. Type 'help' to see what I can assist you with!",
    "I'm still learning! Type 'menu' to see available options, or 'help' for assistance.",
    "Sorry, I don't understand that yet. Try 'help' to see what I can do! 🤖"
  ],
  
  thanks: [
    "You're welcome! 😊 Is there anything else I can help you with?",
    "Happy to help! Let me know if you need anything else! 🌟",
    "Glad I could assist! Feel free to ask if you have more questions! 👍"
  ],
  
  factCheckProcessing: "🔍 I'm analyzing this video for fact-checking. This may take a moment...",
  
  factCheckComplete: (claim, analysis) => {
    let message = `📊 **Fact-Check Results**\n\n`;
    message += `🎯 **Claim**: ${claim}\n\n`;
    message += `⭐ **Verdict**: ${analysis.verdict} (${analysis.confidence} confidence)\n\n`;
    message += `📝 **Summary**: ${analysis.summary}\n\n`;
    
    if (analysis.sources && analysis.sources.length > 0) {
      message += `🔗 **Sources**:\n`;
      analysis.sources.forEach((source, index) => {
        message += `${index + 1}. ${source.publisher} - ${source.rating}\n`;
        if (source.url) {
          message += `   ${source.url}\n`;
        }
      });
    }
    
    message += `\n💬 You can ask me about this fact-check anytime!`;
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
    const response = await generateResponse(messageText, userState);
    
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
const generateResponse = async (messageText, userState) => {
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
  
  if (text.includes('fact-check') || text.includes('factcheck') || text.includes('history') || text.includes('previous')) {
    const history = factChecker.getUserFactCheckHistory(senderId);
    return {
      type: 'text',
      text: botResponses.factCheckHistory(history)
    };
  }
  
  // Default response
  return {
    type: 'text',
    text: getRandomResponse(botResponses.default)
  };
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
  clearConversationState
}; 