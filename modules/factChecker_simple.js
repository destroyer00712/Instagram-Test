const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cheerio = require('cheerio');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configurations
const MODELS = {
  CLAIM_ANALYSIS: 'gemini-1.5-pro',
  FALLBACK: 'gemini-2.0-flash-exp'
};

const GENERATION_CONFIGS = {
  HIGH_ACCURACY: {
    temperature: 0.1,
    maxOutputTokens: 2048,
    topP: 0.8,
    topK: 20
  }
};

// In-memory storage
const factCheckMemory = new Map();
const articleContentCache = new Map();

/**
 * Helper function to make Gemini API calls
 */
const makeGeminiAPICall = async (modelName, generationConfig, prompt, additionalContent = []) => {
  console.log(`🤖 [makeGeminiAPICall] Attempting API call with model: ${modelName}`);
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: generationConfig
    });
    
    const content = Array.isArray(prompt) ? prompt : [prompt, ...additionalContent];
    const result = await model.generateContent(content);
    
    console.log(`✅ [makeGeminiAPICall] API call successful with model: ${modelName}`);
    return { result, modelUsed: modelName };
    
  } catch (error) {
    if (modelName.includes('pro') && error.message && error.message.includes('quota')) {
      console.log(`⚠️ [makeGeminiAPICall] ${modelName} quota exceeded, falling back to ${MODELS.FALLBACK}`);
      
      try {
        const fallbackModel = genAI.getGenerativeModel({ 
          model: MODELS.FALLBACK,
          generationConfig: generationConfig
        });
        
        const content = Array.isArray(prompt) ? prompt : [prompt, ...additionalContent];
        const result = await fallbackModel.generateContent(content);
        
        console.log(`✅ [makeGeminiAPICall] Fallback API call successful with model: ${MODELS.FALLBACK}`);
        return { result, modelUsed: MODELS.FALLBACK };
        
      } catch (fallbackError) {
        console.log(`❌ [makeGeminiAPICall] Fallback also failed:`, fallbackError.message);
        throw fallbackError;
      }
    } else {
      throw error;
    }
  }
};

/**
 * SIMPLIFIED: Create targeted search queries for any news claim
 */
const createSearchQueries = (claim) => {
  console.log(`🧠 Creating search queries for: ${claim}`);
  
  // Generate multiple search approaches
  const queries = [
    `"${claim}" news`,
    `${claim} latest news`,
    `${claim} breaking news report`,
    claim // Basic claim search
  ];
  
  console.log(`✅ Created ${queries.length} search queries`);
  return queries;
};

/**
 * Scrape article content from URL
 */
const scrapeArticleContent = async (url, title = '') => {
  console.log(`🔗 Scraping article: ${url}`);
  
  if (articleContentCache.has(url)) {
    console.log(`📋 Using cached content for ${url}`);
    return articleContentCache.get(url);
  }
  
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads').remove();
    
    // Extract main content
    let content = '';
    const contentSelectors = [
      'article', 
      '[role="main"]', 
      '.post-content', 
      '.article-content',
      '.story-body',
      'main',
      '.content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }
    
    // Fallback to body content
    if (!content || content.length < 200) {
      content = $('body').text().trim();
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    if (content.length < 100) {
      throw new Error('Content too short');
    }
    
    console.log(`✅ Article scraped successfully (${content.length} chars)`);
    
    // Cache the content
    articleContentCache.set(url, content);
    
    return content;
    
  } catch (error) {
    console.log(`❌ Error scraping ${url}: ${error.message}`);
    
    // Return fallback content based on title
    const fallbackContent = title ? `Article title: ${title}. Unable to access full content.` : '';
    return fallbackContent;
  }
};

/**
 * SIMPLIFIED: Analyze article content with AI to determine if claim is true/false
 */
const analyzeArticleForClaim = async (claim, articleContent, articleTitle = '', articleUrl = '') => {
  console.log(`🤖 Analyzing article content for claim verification...`);
  
  const prompt = `You are a fact-checking expert. Analyze this article content to verify a specific claim.

CLAIM TO VERIFY: "${claim}"

ARTICLE TITLE: "${articleTitle}"
ARTICLE URL: "${articleUrl}"
ARTICLE CONTENT: 
"${articleContent.substring(0, 3000)}${articleContent.length > 3000 ? '...' : ''}"

TASK: Determine if this article CONFIRMS, DENIES, or is UNCLEAR about the specific claim.

IMPORTANT INSTRUCTIONS:
1. **BE DECISIVE** - If the article clearly states something happened, mark as TRUE
2. **READ CAREFULLY** - Look for direct mentions of the people, events, numbers in the claim
3. **FACTUAL REPORTING** - If reputable news sources report it as fact, it's likely TRUE
4. **OFFICIAL STATEMENTS** - Government/company official statements should be treated as factual
5. **CLEAR DENIALS** - Only mark FALSE if article explicitly contradicts the claim

EXAMPLES:
- If claim is "Adani bought land for 1 rupee" and article says "Adani acquired land for ₹1", mark TRUE
- If claim is "Person X died" and article reports their death, mark TRUE  
- If claim is "Company Y acquired Z" and article confirms the acquisition, mark TRUE
- Only mark FALSE if article explicitly says "This did NOT happen" or provides contradicting facts

OUTPUT FORMAT (JSON only):
{
  "verdict": "TRUE|FALSE|UNCLEAR",
  "confidence": "HIGH|MEDIUM|LOW",
  "reasoning": "Brief explanation of why this verdict was reached",
  "keyEvidence": ["Key evidence point 1", "Key evidence point 2"]
}`;

  try {
    const { result } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      prompt
    );

    const response = result.response.text().trim();
    
    // Clean up the response to extract JSON
    let cleanResponse = response;
    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.split('```json')[1].split('```')[0].trim();
    } else if (cleanResponse.includes('```')) {
      cleanResponse = cleanResponse.split('```')[1].split('```')[0].trim();
    }
    
    try {
      const analysis = JSON.parse(cleanResponse);
      console.log(`✅ AI analysis: ${analysis.verdict} (${analysis.confidence})`);
      console.log(`📝 Reasoning: ${analysis.reasoning}`);
      
      return {
        verdict: analysis.verdict || 'UNCLEAR',
        confidence: analysis.confidence || 'LOW',
        reasoning: analysis.reasoning || 'No reasoning provided',
        keyEvidence: analysis.keyEvidence || []
      };
      
    } catch (jsonError) {
      console.log(`⚠️ JSON parse failed, extracting manually`);
      
      const verdictMatch = cleanResponse.match(/(?:verdict|VERDICT).*?(?:TRUE|FALSE|MIXED|UNCLEAR)/i);
      const confidenceMatch = cleanResponse.match(/(?:confidence|CONFIDENCE).*?(?:HIGH|MEDIUM|LOW)/i);
      
      return {
        verdict: verdictMatch ? verdictMatch[0].split(/[:"]/)[1].trim().toUpperCase() : 'UNCLEAR',
        confidence: confidenceMatch ? confidenceMatch[0].split(/[:"]/)[1].trim().toUpperCase() : 'LOW',
        reasoning: 'Manual extraction from AI response',
        keyEvidence: []
      };
    }
    
  } catch (error) {
    console.log(`❌ AI analysis failed: ${error.message}`);
    return {
      verdict: 'UNCLEAR',
      confidence: 'LOW',
      reasoning: 'AI analysis failed',
      keyEvidence: []
    };
  }
};

/**
 * COMPLETELY REWRITTEN: Simple fact-checking using ONLY Google Custom Search + AI
 */
const searchFactChecks = async (claim) => {
  console.log(`🔍 SIMPLE FACT-CHECK: ${claim}`);
  
  // Create search queries
  const searchQueries = createSearchQueries(claim);
  
  let allResults = [];
  
  // Search Google Custom Search for each query
  for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries
    try {
      console.log(`🌐 Searching Google: "${query}"`);
      
      const searchUrl = 'https://www.googleapis.com/customsearch/v1';
      const params = {
        key: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
        cx: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
        q: query,
        num: 5,
        tbm: 'nws' // News search
      };
      
      const response = await axios.get(searchUrl, { params, timeout: 10000 });
      
      if (response.data.items && response.data.items.length > 0) {
        console.log(`✅ Found ${response.data.items.length} articles`);
        
        // Process each article
        for (const item of response.data.items.slice(0, 3)) { // Top 3 articles per query
          try {
            console.log(`📰 Processing: ${item.title}`);
            
            // Scrape article content
            const content = await scrapeArticleContent(item.link, item.title);
            
            if (content && content.length > 100) {
              // Analyze with AI
              const analysis = await analyzeArticleForClaim(claim, content, item.title, item.link);
              
              // Create result object
              const result = {
                claim: claim,
                publisher: item.displayLink || 'Unknown',
                url: item.link,
                title: item.title,
                snippet: item.snippet || '',
                rating: mapVerdictToRating(analysis.verdict),
                date: new Date().toISOString(),
                sourceType: 'google_search',
                aiAnalysis: analysis
              };
              
              allResults.push(result);
              console.log(`✅ Added result: ${analysis.verdict} from ${result.publisher}`);
              
            } else {
              console.log(`⚠️ Skipping - insufficient content`);
            }
            
            // Small delay between articles
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (articleError) {
            console.log(`❌ Error processing article: ${articleError.message}`);
          }
        }
      } else {
        console.log(`❌ No results for: "${query}"`);
      }
      
      // Delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (searchError) {
      console.log(`❌ Search error for "${query}": ${searchError.message}`);
    }
  }
  
  console.log(`✅ Total results found: ${allResults.length}`);
  return allResults;
};

/**
 * Map AI verdict to rating
 */
const mapVerdictToRating = (verdict) => {
  switch(verdict?.toUpperCase()) {
    case 'TRUE': return 'True';
    case 'FALSE': return 'False';
    case 'MIXED': return 'Mixed';
    case 'UNCLEAR': return 'Unrated';
    default: return 'Unrated';
  }
};

/**
 * SIMPLIFIED: Analyze results and give final verdict
 */
const analyzeFactChecks = async (factCheckResults, originalClaim) => {
  console.log(`📊 SIMPLE ANALYSIS: Processing ${factCheckResults.length} Google Custom Search results`);
  
  if (!factCheckResults || factCheckResults.length === 0) {
    return {
      verdict: 'Unknown',
      confidence: 'Low',
      summary: 'No relevant articles found to verify this claim.',
      sources: []
    };
  }
  
  // Count verdicts
  let trueCount = 0;
  let falseCount = 0;
  let mixedCount = 0;
  let unclearCount = 0;
  let totalConfidence = 0;
  
  console.log(`📰 Article Analysis:`);
  factCheckResults.forEach((result, i) => {
    const verdict = result.aiAnalysis?.verdict?.toUpperCase() || 'UNCLEAR';
    const confidence = result.aiAnalysis?.confidence?.toUpperCase() || 'LOW';
    
    console.log(`  ${i + 1}. ${result.publisher}: ${verdict} (${confidence})`);
    
    switch (verdict) {
      case 'TRUE': trueCount++; break;
      case 'FALSE': falseCount++; break;
      case 'MIXED': mixedCount++; break;
      default: unclearCount++; break;
    }
    
    // Add confidence scores
    if (confidence === 'HIGH') totalConfidence += 0.9;
    else if (confidence === 'MEDIUM') totalConfidence += 0.7;
    else totalConfidence += 0.4;
  });
  
  const avgConfidence = totalConfidence / factCheckResults.length;
  
  console.log(`📊 Vote Count: TRUE=${trueCount}, FALSE=${falseCount}, MIXED=${mixedCount}, UNCLEAR=${unclearCount}`);
  console.log(`📊 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  
  // SIMPLE DECISION LOGIC: Majority wins
  let finalVerdict = 'Unknown';
  let finalConfidence = 'Low';
  
  if (trueCount > falseCount && trueCount > mixedCount && trueCount > unclearCount) {
    finalVerdict = 'True';
    finalConfidence = avgConfidence > 0.8 ? 'High' : (avgConfidence > 0.6 ? 'Medium' : 'Low');
    console.log(`🎯 VERDICT: TRUE (${trueCount} sources confirm)`);
  } else if (falseCount > trueCount && falseCount > mixedCount && falseCount > unclearCount) {
    finalVerdict = 'False';  
    finalConfidence = avgConfidence > 0.8 ? 'High' : (avgConfidence > 0.6 ? 'Medium' : 'Low');
    console.log(`🎯 VERDICT: FALSE (${falseCount} sources contradict)`);
  } else if (mixedCount > 0 && (trueCount + falseCount) > 0) {
    finalVerdict = 'Mixed';
    finalConfidence = 'Medium';
    console.log(`🎯 VERDICT: MIXED (conflicting evidence)`);
  } else {
    console.log(`🎯 VERDICT: UNKNOWN (no clear evidence)`);
  }
  
  // Generate simple summary
  let summary = `Based on ${factCheckResults.length} Google Custom Search article${factCheckResults.length !== 1 ? 's' : ''}, `;
  
  switch (finalVerdict) {
    case 'True':
      summary += `**this claim is TRUE**. ${trueCount} source${trueCount !== 1 ? 's' : ''} confirm this information.`;
      break;
    case 'False':
      summary += `**this claim is FALSE**. ${falseCount} source${falseCount !== 1 ? 's' : ''} contradict this information.`;
      break;
    case 'Mixed':
      summary += `**this claim is PARTIALLY TRUE** with conflicting evidence from ${factCheckResults.length} sources.`;
      break;
    default:
      summary += `**insufficient clear evidence** to verify this claim.`;
  }
  
  console.log(`🏁 FINAL: ${finalVerdict} (${finalConfidence})`);
  
  return {
    verdict: finalVerdict,
    confidence: finalConfidence,
    summary: summary,
    sources: factCheckResults.map(r => ({
      publisher: r.publisher,
      url: r.url,
      aiVerdict: r.aiAnalysis?.verdict,
      sourceType: 'google_search'
    }))
  };
};

// Export only the essential functions
module.exports = {
  searchFactChecks,
  analyzeFactChecks,
  makeGeminiAPICall,
  // Keep some functions for compatibility
  getUserFactCheckHistory: (userId) => factCheckMemory.get(userId) || [],
  generateDetailedExplanation: async (claim, analysis) => ({ found: true, response: "Detailed analysis not implemented in simple version" }),
  generateGeneralConversation: async (userId, message) => ({ found: true, response: "General conversation not implemented in simple version" }),
  generateConversationalResponse: async (userId, query, checks) => ({ found: true, response: "Conversational response not implemented in simple version" })
};
