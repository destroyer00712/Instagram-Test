const instagramAPI = require('./instagramAPI');

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
  ]
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
    
    const responses = [
      "Thanks for sharing that! 📸",
      "I can see you've sent me something, but I can only respond to text messages right now. 🤖",
      "Nice! If you have any questions, just send me a text message and I'll be happy to help! 😊"
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    await instagramAPI.sendMessage(senderId, response);
    
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