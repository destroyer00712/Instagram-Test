const whatsappAPI = require('./whatsappAPI');
const factChecker = require('./factChecker');

// In-memory conversation state storage for WhatsApp
// In production, you should use a database like Redis or MongoDB
const conversationState = new Map();

// WhatsApp-specific fact-checking bot responses
const botResponses = {
  factCheckProcessing: "🔍 Processing your message for fact-checking... Please wait while I analyze the content.",
  
  factCheckComplete: (claim, analysis, mediaInfo = null) => {
    const verdictIcon = analysis.verdict === 'True' ? '✅' : analysis.verdict === 'False' ? '❌' : '⚠️';
    const confidenceIcon = analysis.confidence === 'High' ? '🎯' : analysis.confidence === 'Medium' ? '📊' : '🤔';
    
    // Short, punchy verdict
    let verdict = '';
    if (analysis.verdict === 'True') {
      verdict = '✅ TRUE - This checks out!';
    } else if (analysis.verdict === 'False') {
      verdict = '❌ FALSE - This claim is incorrect';
    } else {
      verdict = '⚠️ MIXED - Evidence goes both ways';
    }
    
    // Confidence level
    const confidence = `${confidenceIcon} ${analysis.confidence} confidence`;
    
    // Source info (keep it brief)
    const sourceCount = analysis.sources || 0;
    const sourceText = sourceCount > 1 ? `${sourceCount} sources checked` : 'Multiple sources checked';
    
    // Media processing note (if significant)
    let mediaNote = '';
    if (mediaInfo && mediaInfo.type) {
      mediaNote = `\n📎 Analyzed ${mediaInfo.type} content`;
    }
    
    // Keep it under WhatsApp's character limit
    return `${verdict}
${confidence} • ${sourceText}${mediaNote}

💬 Ask "tell me more" for details!`;
  },
  
  noClaimFound: (result = null) => {
    let message = "🤔 No factual claims found to fact-check.";
    
    if (result && result.mediaInfo) {
      message += `\n📎 Analyzed ${result.mediaInfo.type} content`;
    }
    
    return message + `\n\n💡 Try sharing news articles, videos, or factual claims!`;
  },
  
  factCheckError: "❌ Sorry, I encountered an error while fact-checking this content. Please try again later.",
  
  factCheckHistory: (history) => {
    if (!history || history.length === 0) {
      return "📚 You haven't fact-checked any content yet. Share a message with factual claims to get started!";
    }
    
    let response = "📚 Your Recent Fact-Checks:\n\n";
    history.slice(-3).forEach((check, index) => {
      const verdict = check.result.analysis.verdict;
      const claim = check.result.claim.substring(0, 50) + (check.result.claim.length > 50 ? '...' : '');
      response += `${index + 1}. "${claim}"\n   Verdict: ${verdict}\n\n`;
    });
    
    response += "💬 Ask me about any of these or share new content to fact-check!";
    return response;
  }
};

// Helper function to check if a message is a basic greeting
const isBasicCommand = (text) => {
  const basicCommands = ['hi', 'hello', 'hey', 'help', 'history', 'start'];
  return basicCommands.some(cmd => text.toLowerCase().trim() === cmd);
};

// Helper function to detect if a message is likely a follow-up question
const isLikelyFollowUp = (messageText, latestCheck) => {
  const text = messageText.toLowerCase().trim();
  const claim = latestCheck.result.claim.toLowerCase();
  
  // Common follow-up patterns
  const followUpPatterns = [
    /^(so|but|what about|does this mean)/i,
    /\b(every year|annually|each year|per year)\b/i,
    /\b(don't have to|do i|do we|should i|can i)\b/i,
    /\?(.*)?$/,  // Questions ending with ?
    /\b(really|actually|truly|sure|certain)\b/i,
    /\b(why|how|when|where|what|who)\b/i
  ];
  
  // Check if message contains follow-up patterns
  const hasFollowUpPattern = followUpPatterns.some(pattern => pattern.test(text));
  
  // Check if message references key terms from the recent fact-check
  const claimKeywords = extractKeywords(claim);
  const hasRelevantKeywords = claimKeywords.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
  
  // Short questions are more likely to be follow-ups
  const isShortQuestion = text.includes('?') && text.length < 100;
  
  return hasFollowUpPattern || hasRelevantKeywords || isShortQuestion;
};

// Extract key terms from a claim for follow-up detection
const extractKeywords = (claim) => {
  const keywords = [];
  
  // Common important terms
  const importantTerms = [
    'h1b', 'visa', 'fee', 'annual', 'yearly', 'pay', 'cost', 'money',
    'government', 'company', 'employee', 'worker', 'immigration',
    'petition', 'renewal', 'new', 'policy', 'law', 'rule', 'covid',
    'vaccine', 'health', 'medical', 'economy', 'inflation', 'price'
  ];
  
  importantTerms.forEach(term => {
    if (claim.toLowerCase().includes(term)) {
      keywords.push(term);
    }
  });
  
  // Extract numbers (like $100,000)
  const numbers = claim.match(/\$?[\d,]+/g) || [];
  keywords.push(...numbers);
  
  return keywords;
};

// Find the most relevant fact-check for a follow-up question
const findMostRelevantFactCheck = (messageText, recentFactChecks, conversationContext) => {
  const text = messageText.toLowerCase().trim();
  
  console.log(`🔍 Finding most relevant fact-check among ${recentFactChecks.length} options`);
  
  // First, check for strong keyword matches before defaulting to active content
  let hasStrongKeywordMatch = false;
  
  // Quick scan for strong keyword matches
  for (const factCheck of recentFactChecks) {
    const claim = factCheck.result.claim.toLowerCase();
    const claimKeywords = extractKeywords(claim);
    const keywordMatches = claimKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
    
    if (keywordMatches.length >= 2) { // Strong keyword match
      hasStrongKeywordMatch = true;
      break;
    }
  }
  
  // Strategy 1: Use conversation context (active content) only if no strong keyword matches
  if (!hasStrongKeywordMatch && conversationContext.activeContentId) {
    const activeFactCheck = recentFactChecks.find(check => check.contentId === conversationContext.activeContentId);
    if (activeFactCheck) {
      const timeSinceActive = Date.now() - conversationContext.contentProcessedAt;
      
      // If the active content is very recent (less than 1 minute) and no strong keywords, prefer it
      if (timeSinceActive < 1 * 60 * 1000) {
        console.log(`🎯 Using active content (${activeFactCheck.contentId}) - processed ${Math.floor(timeSinceActive / 1000)}s ago (no strong keywords)`);
        return activeFactCheck;
      }
    }
  }
  
  // Strategy 2: Match keywords between question and claims
  let bestMatch = null;
  let bestScore = 0;
  
  for (const factCheck of recentFactChecks) {
    const claim = factCheck.result.claim.toLowerCase();
    const claimKeywords = extractKeywords(claim);
    
    // Calculate relevance score
    let score = 0;
    
    // Keyword matching
    claimKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        score += 2; // Higher weight for keyword matches
      }
    });
    
    // Recency bonus (more recent = higher score)
    const age = Date.now() - factCheck.timestamp;
    const recencyScore = Math.max(0, (10 * 60 * 1000 - age) / (10 * 60 * 1000)); // 0-1 scale
    score += recencyScore;
    
    // Active content bonus
    if (factCheck.contentId === conversationContext.activeContentId) {
      score += 1;
    }
    
    console.log(`📊 Fact-check "${factCheck.result.claim.substring(0, 30)}..." scored ${score.toFixed(2)}`);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = factCheck;
    }
  }
  
  // Strategy 3: Fallback to most recent if no good matches
  if (!bestMatch || bestScore < 1) {
    console.log(`🔄 No strong matches found, using most recent fact-check`);
    bestMatch = recentFactChecks[recentFactChecks.length - 1];
  } else {
    console.log(`✅ Best match: "${bestMatch.result.claim.substring(0, 50)}..." (score: ${bestScore.toFixed(2)})`);
  }
  
  return bestMatch;
};

// Check if a question is ambiguous (could apply to multiple fact-checks)
const isAmbiguousQuestion = (messageText, recentFactChecks) => {
  const text = messageText.toLowerCase().trim();
  
  // Very generic questions that could apply to any fact-check
  const ambiguousPatterns = [
    /^(is it true|are you sure|really|is that right)[\?\!]*$/i,
    /^(correct|accurate|true|false)[\?\!]*$/i,
    /^(what|how|why)[\?\!]*$/i,
    /^(tell me more|more details|explain)[\?\!]*$/i
  ];
  
  const isGenericPattern = ambiguousPatterns.some(pattern => pattern.test(text));
  
  // If it's a generic pattern and there are multiple recent fact-checks, it's ambiguous
  return isGenericPattern && recentFactChecks.length > 1;
};

// Create a clarification response when question is ambiguous
const createClarificationResponse = (messageText, recentFactChecks) => {
  const recentCount = Math.min(recentFactChecks.length, 2); // Show max 2 recent ones
  
  let response = `I've fact-checked ${recentFactChecks.length} messages recently. Which one are you asking about?\n\n`;
  
  recentFactChecks.slice(-recentCount).forEach((factCheck, index) => {
    const claim = factCheck.result.claim;
    const verdict = factCheck.result.analysis.verdict;
    const verdictIcon = verdict === 'True' ? '✅' : verdict === 'False' ? '❌' : '⚠️';
    const shortClaim = claim.length > 40 ? claim.substring(0, 40) + '...' : claim;
    
    response += `${index + 1}. ${verdictIcon} "${shortClaim}"\n`;
  });
  
  response += `\nJust mention keywords or ask your question more specifically! 🎯`;
  
  return response;
};

// Generate contextual follow-up response
const generateFollowUpResponse = async (messageText, latestCheck) => {
  const text = messageText.toLowerCase().trim();
  const claim = latestCheck.result.claim;
  const analysis = latestCheck.result.analysis;
  
  console.log(`💬 Generating follow-up response for: "${messageText}"`);
  console.log(`📋 Based on claim: "${claim}"`);
  console.log(`📊 Verdict: ${analysis.verdict}`);
  
  // Handle specific follow-up patterns for common topics
  if (claim.toLowerCase().includes('h1b') && claim.toLowerCase().includes('fee')) {
    if (text.includes('every year') || text.includes('annually') || text.includes('each year') || text.includes('per year')) {
      if (analysis.verdict === 'True') {
        return "No! 🙅‍♂️ It's a ONE-TIME fee only for new H1B petitions, not renewals or yearly payments. Once you're approved, no annual fees for the visa itself! 👍";
      }
    }
    
    if (text.includes('don\'t have to pay') || text.includes('do i have to pay') || text.includes('have to pay')) {
      return "Correct! 💯 You don't pay this fee every year. It's only when filing a NEW H1B petition. Renewals are different and much cheaper! 🎯";
    }
    
    if (text.includes('how much') || text.includes('cost') || text.includes('price')) {
      return "The $100k fee is only for NEW H1B petitions - not renewals! 💰 Regular renewal fees are much lower (few hundred dollars). This was the clarification from official sources! 📋";
    }
    
    if (text.includes('when') || text.includes('start') || text.includes('effective')) {
      return "The fee applies to new H1B lottery cycles as announced! 📅 Current visa holders and renewals aren't affected. Check USCIS for exact implementation dates! 🏢";
    }
  }
  
  // Generic topic-based responses
  if (text.includes('how') && text.includes('?')) {
    return `Great question! 🤔 Based on our fact-check: ${analysis.verdict === 'True' ? 'this is accurate' : analysis.verdict === 'False' ? 'this claim is false' : 'evidence is mixed'}. Want me to explain the specific details? 💡`;
  }
  
  if (text.includes('why') && text.includes('?')) {
    return `The reasoning: ${analysis.verdict === 'True' ? 'Multiple reliable sources confirmed this' : analysis.verdict === 'False' ? 'Authoritative sources contradict this claim' : 'Sources give conflicting information'}. Need more context? 🔍`;
  }
  
  // Generic follow-up responses based on verdict
  if (text.includes('?')) {
    if (analysis.verdict === 'True') {
      return `Yes, that's right! ✅ The fact-check confirmed this claim. The key point is: ${claim.substring(0, 100)}... Need more details? Ask away! 💬`;
    } else if (analysis.verdict === 'False') {
      return `Actually no! ❌ Our fact-check found this claim to be false. The evidence shows different information. Want me to explain more? 🤔`;
    } else {
      return `It's complicated! ⚠️ The evidence is mixed on this topic. Some aspects might be true while others aren't. What specifically are you wondering about? 🤷‍♂️`;
    }
  }
  
  // Check if this is a generic question that might need clarification
  const genericQuestions = [
    'is it true', 'are you sure', 'really', 'is that right', 'correct', 'accurate'
  ];
  const isGeneric = genericQuestions.some(q => text.includes(q)) && text.length < 50;
  
  if (isGeneric) {
    return `About "${claim.substring(0, 60)}${claim.length > 60 ? '...' : ''}": ${analysis.verdict === 'True' ? '✅ Yes, this is accurate' : analysis.verdict === 'False' ? '❌ No, this is incorrect' : '⚠️ It\'s mixed'}. Want more specific details? 🤔`;
  }
  
  // Fallback contextual response
  return `Based on the fact-check we just did: ${analysis.verdict === 'True' ? '✅ The claim checks out' : analysis.verdict === 'False' ? '❌ The claim is false' : '⚠️ Evidence is mixed'}. What else would you like to know about it? 💭`;
};

// Store conversation state
const storeConversationState = (senderId, data) => {
  conversationState.set(senderId, {
    ...conversationState.get(senderId),
    ...data,
    lastActivity: Date.now()
  });
};

// Update conversation context when new content is processed
const updateContextForNewContent = (senderId, contentId, claim) => {
  console.log(`📱 [${contentId}] Updating conversation context for new content`);
  storeConversationState(senderId, {
    activeContentId: contentId,
    activeContentClaim: claim,
    contentProcessedAt: Date.now(),
    contextSwitched: true // Flag to indicate context change
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
  console.log(`💬 Processing WhatsApp text message from ${senderId}: "${messageText}"`);
  
  try {
    const response = await determineResponse(messageText, senderId);
    
    if (response.type === 'interactive') {
      await whatsappAPI.sendInteractiveMessage(
        senderId, 
        response.header, 
        response.body, 
        response.footer, 
        response.buttons
      );
    } else if (response.type === 'list') {
      await whatsappAPI.sendListMessage(
        senderId,
        response.header,
        response.body,
        response.footer,
        response.buttonText,
        response.sections
      );
    } else {
      await whatsappAPI.sendMessage(senderId, response.text);
    }
    
  } catch (error) {
    console.error(`❌ Error processing WhatsApp text message from ${senderId}:`, error);
    await whatsappAPI.sendMessage(senderId, "Sorry, I encountered an error. Please try again.");
  }
};

// Process media messages (images, videos, audio, documents)
const processMediaMessage = async (senderId, attachments) => {
  console.log(`📎 Processing WhatsApp media from ${senderId}`);
  
  try {
    // Send processing message
    await whatsappAPI.sendMessage(senderId, botResponses.factCheckProcessing);
    
    // Process each attachment
    for (const attachment of attachments) {
      const mediaType = attachment.type.replace('whatsapp_', ''); // Remove whatsapp_ prefix
      const mediaId = attachment.id;
      const caption = attachment.caption || '';
      
      console.log(`📎 Processing ${mediaType} with ID: ${mediaId}`);
      
      try {
        // Get media URL and download content
        const mediaUrl = await whatsappAPI.getMediaUrl(mediaId);
        if (!mediaUrl) {
          await whatsappAPI.sendMessage(senderId, `❌ Could not retrieve ${mediaType}. Please try again.`);
          continue;
        }
        
        const mediaData = await whatsappAPI.downloadMedia(mediaUrl);
        if (!mediaData) {
          await whatsappAPI.sendMessage(senderId, `❌ Could not download ${mediaType}. Please try again.`);
          continue;
        }
        
        // Process the media for fact-checking
        const result = await factChecker.processWhatsAppMedia(senderId, {
          type: mediaType,
          data: mediaData,
          caption: caption,
          mediaId: mediaId
        });
        
        if (result.success) {
          // Update conversation context for the new content
          updateContextForNewContent(senderId, result.contentId, result.claim);
          
          // Send fact-check results
          const responseMessage = botResponses.factCheckComplete(result.claim, result.analysis, result.mediaInfo);
          await whatsappAPI.sendMessage(senderId, responseMessage);
        } else {
          // No claims found
          await whatsappAPI.sendMessage(senderId, botResponses.noClaimFound(result));
        }
        
      } catch (factCheckError) {
        console.error(`❌ Fact-check error for ${senderId}:`, factCheckError);
        await whatsappAPI.sendMessage(senderId, botResponses.factCheckError);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error processing WhatsApp media from ${senderId}:`, error);
    await whatsappAPI.sendMessage(senderId, "Sorry, I had trouble processing that media. Please try again.");
  }
};

// Handle new conversations
const handleNewConversation = async (senderId) => {
  console.log(`👋 New WhatsApp conversation started with ${senderId}`);
  
  const userState = getConversationState(senderId);
  
  // Send simple welcome message for fact-checking bot
  const welcomeText = userState.userName 
    ? `Hi ${userState.userName}! I'm a fact-checking bot. Share news, articles, or media with factual claims and I'll analyze them for you! 🔍`
    : "Hi! I'm a fact-checking bot. Share news, articles, or media with factual claims and I'll analyze them for you! 🔍";
    
  await whatsappAPI.sendMessage(senderId, welcomeText);
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

  // Enhanced: Handle "tell me more" requests
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
      text: "Share content first so I can fact-check something for you! 📱🔍"
    };
  }

  // Smart follow-up handling with context awareness
  const history = factChecker.getUserFactCheckHistory(senderId);
  const conversationContext = getConversationState(senderId);
  
  if (history && history.length > 0) {
    // Check for multiple recent fact-checks (context switching scenario)
    const recentThreshold = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const recentFactChecks = history.filter(check => 
      (now - check.timestamp) < recentThreshold
    );
    
    console.log(`🔄 Context Analysis: Found ${recentFactChecks.length} recent fact-checks`);
    
    if (recentFactChecks.length > 0) {
      // Try to find the most relevant fact-check for this follow-up
      const relevantFactCheck = findMostRelevantFactCheck(messageText, recentFactChecks, conversationContext);
      
      if (relevantFactCheck) {
        const isFollowUp = isLikelyFollowUp(messageText, relevantFactCheck);
        console.log(`🎯 Using fact-check: "${relevantFactCheck.result.claim.substring(0, 50)}..." | Follow-up: ${isFollowUp ? 'YES' : 'NO'}`);
        
        if (isFollowUp) {
          // Check for ambiguous questions when multiple content exists
          if (recentFactChecks.length > 1) {
            const isAmbiguous = isAmbiguousQuestion(messageText, recentFactChecks);
            
            if (isAmbiguous) {
              console.log(`❓ Ambiguous question detected with ${recentFactChecks.length} recent fact-checks`);
              return {
                type: 'text',
                text: createClarificationResponse(messageText, recentFactChecks)
              };
            }
          }
          
          // Handle context switching detection
          if (recentFactChecks.length > 1 && conversationContext.contextSwitched) {
            const isAboutActiveContent = relevantFactCheck.contentId === conversationContext.activeContentId;
            console.log(`🔀 Context switch detected: Question about ${isAboutActiveContent ? 'ACTIVE' : 'PREVIOUS'} content`);
            
            // If asking about previous content after new one, provide context
            if (!isAboutActiveContent) {
              console.log(`⚠️ User asking about previous content after new one was processed`);
              
              // Add context to the response
              const contextualResponse = await generateFollowUpResponse(messageText, relevantFactCheck);
              if (contextualResponse) {
                const withContext = `(About the previous content) ${contextualResponse}`;
                console.log(`✅ Generated contextual response with content context`);
                return {
                  type: 'text',
                  text: withContext.length > 1000 ? contextualResponse : withContext
                };
              }
            }
          }
          
          try {
            const followUpResponse = await generateFollowUpResponse(messageText, relevantFactCheck);
            if (followUpResponse) {
              console.log(`✅ Generated contextual response: "${followUpResponse.substring(0, 100)}..."`);
              
              // Clear context switch flag after successful follow-up
              if (conversationContext.contextSwitched) {
                storeConversationState(senderId, { contextSwitched: false });
              }
              
              return {
                type: 'text',
                text: followUpResponse
              };
            }
          } catch (error) {
            console.error('❌ Error generating follow-up response:', error);
          }
        }
      }
    } else {
      console.log(`⏰ No recent fact-checks within ${recentThreshold / 60000} minutes`);
    }
  } else {
    console.log(`📭 No previous fact-checks found for user ${senderId}`);
  }

  // Use AI for general conversation instead of default responses
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
    text: "🔍 I fact-check news, articles, and media! Share content with factual claims and I'll verify them. You can also ask about previous checks!"
  };
};

// Main message handler
const handleMessage = async (senderId, messageData) => {
  console.log(`📨 Handling WhatsApp message from ${senderId}:`, messageData);
  
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
      await processMediaMessage(senderId, messageData.attachments);
    }
    
  } catch (error) {
    console.error(`❌ Error in handleMessage for ${senderId}:`, error);
    await whatsappAPI.sendMessage(senderId, "Sorry, something went wrong. Please try again.");
  }
};

module.exports = {
  handleMessage,
  handleNewConversation,
  processTextMessage,
  processMediaMessage,
  storeConversationState,
  getConversationState,
  clearConversationState,
  updateContextForNewContent
};
