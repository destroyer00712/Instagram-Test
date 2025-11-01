const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cheerio = require('cheerio');
const vectorCache = require('./vectorCache');

// DISABLE VECTOR CACHE FOR PERFORMANCE - Set to false to completely skip vector DB operations
const ENABLE_VECTOR_CACHE = false;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configurations
const MODELS = {
  CLAIM_ANALYSIS: 'gemini-2.5-pro',
  TRANSCRIPTION: 'gemini-2.5-pro',
  VISUAL_ANALYSIS: 'gemini-2.5-pro', 
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
1. **FOCUS ON CORE TRUTH** - Don't get stuck on minor technicalities like "1 rupee" vs "1 rupee per year"
2. **BE DECISIVE** - If the essence of the claim is supported by the article, mark as TRUE
3. **LOOK FOR THE MAIN EVENT** - Did the core event happen? (land acquisition, death, business deal, etc.)
4. **IGNORE MINOR DETAILS** - Focus on whether the main claim is substantially correct
5. **ONLY MARK FALSE** if the article explicitly says the event did NOT happen

EXAMPLES:
- Claim: "Adani bought land for 1 rupee" + Article: "Adani got land for ₹1 per year" → **TRUE** (core event happened)
- Claim: "Person X died" + Article: "Person X passed away yesterday" → **TRUE** (same event, different words)
- Claim: "Company bought Company Y" + Article: "Merger completed between companies" → **TRUE** (acquisition happened)
- Claim: "Event X happened" + Article: "Event X never occurred, it's fake news" → **FALSE** (explicit denial)

**PRIORITY: If a reputable news source reports something happened, it probably did happen - mark as TRUE unless explicitly denied.**

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
  
  // ENHANCED DECISION LOGIC: Be decisive when authoritative sources are clear
  let finalVerdict = 'Unknown';
  let finalConfidence = 'Low';
  
  // Count high-confidence sources
  const highConfidenceFalse = factCheckResults.filter(r => 
    r.aiAnalysis?.verdict === 'FALSE' && r.aiAnalysis?.confidence === 'HIGH'
  ).length;
  
  const highConfidenceTrue = factCheckResults.filter(r => 
    r.aiAnalysis?.verdict === 'TRUE' && r.aiAnalysis?.confidence === 'HIGH'  
  ).length;
  
  console.log(`🔍 High-confidence sources: TRUE=${highConfidenceTrue}, FALSE=${highConfidenceFalse}`);
  
  // PRIORITY: If ANY high-confidence source says FALSE (conspiracy theories), lean FALSE
  if (highConfidenceFalse > 0 && falseCount >= highConfidenceFalse) {
    finalVerdict = 'False';
    finalConfidence = highConfidenceFalse >= 2 ? 'High' : 'Medium';
    console.log(`🎯 VERDICT: FALSE (${highConfidenceFalse} high-confidence sources debunk this)`);
    
  // PRIORITY: If ANY high-confidence source says TRUE (real news), lean TRUE  
  } else if (highConfidenceTrue > 0 && trueCount >= highConfidenceTrue) {
    finalVerdict = 'True';
    finalConfidence = highConfidenceTrue >= 2 ? 'High' : 'Medium';
    console.log(`🎯 VERDICT: TRUE (${highConfidenceTrue} high-confidence sources confirm this)`);
    
  // FALLBACK: Standard majority wins
  } else if (trueCount > falseCount && trueCount > 0) {
    finalVerdict = 'True';
    finalConfidence = avgConfidence > 0.8 ? 'High' : (avgConfidence > 0.6 ? 'Medium' : 'Low');
    console.log(`🎯 VERDICT: TRUE (${trueCount} sources confirm)`);
  } else if (falseCount > trueCount && falseCount > 0) {
    finalVerdict = 'False';  
    finalConfidence = avgConfidence > 0.8 ? 'High' : (avgConfidence > 0.6 ? 'Medium' : 'Low');
    console.log(`🎯 VERDICT: FALSE (${falseCount} sources contradict)`);
  } else if (mixedCount > 0) {
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

/**
 * Download video from Instagram URL
 */
const downloadVideo = async (videoUrl, fileName) => {
  console.log(`🎥 Downloading video from: ${videoUrl}`);
  
  // Ensure temp directory exists
  const tempDir = process.env.TEMP_VIDEO_DIR || './temp/videos/';
  await fs.ensureDir(tempDir);
  
  const filePath = path.join(tempDir, fileName);
  
  try {
    console.log(`📡 Starting video download...`);
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      timeout: 60000, // 60 second timeout
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.instagram.com/'
      }
    });
    
    console.log(`📥 Response status: ${response.status}, content-type: ${response.headers['content-type']}`);
    
    if (response.status !== 200) {
      throw new Error(`Failed to download video: HTTP ${response.status}`);
    }
    
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      let bytesDownloaded = 0;
      
      response.data.on('data', (chunk) => {
        bytesDownloaded += chunk.length;
      });
      
      writer.on('finish', () => {
        console.log(`✅ Video downloaded: ${filePath} (${bytesDownloaded} bytes)`);
        resolve(filePath);
      });
      
      writer.on('error', (error) => {
        console.error('❌ File write error:', error);
        reject(error);
      });
      
      response.data.on('error', (error) => {
        console.error('❌ Download stream error:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ Error downloading video:', error.message);
    console.error('❌ Error details:', error.response?.status, error.response?.statusText);
    throw new Error(`Failed to download video: ${error.message}`);
  }
};

/**
 * Extract video frames for analysis
 */
const extractVideoFrames = async (videoPath, frameCount = 5) => {
  console.log(`🖼️ Extracting ${frameCount} frames from: ${videoPath}`);
  
  const framesDir = process.env.TEMP_FRAMES_DIR || './temp/frames/';
  await fs.ensureDir(framesDir);
  
  const framePattern = path.join(framesDir, `${uuidv4()}_frame_%03d.jpg`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        count: frameCount,
        folder: framesDir,
        filename: `${uuidv4()}_frame_%03d.jpg`,
        size: '1280x720' // Standard HD resolution for analysis
      })
      .on('end', () => {
        // Get the generated frame files
        const frameFiles = [];
        for (let i = 1; i <= frameCount; i++) {
          const paddedNum = i.toString().padStart(3, '0');
          const framePath = framePattern.replace('%03d', paddedNum);
          if (fs.existsSync(framePath)) {
            frameFiles.push(framePath);
          }
        }
        console.log(`✅ Extracted ${frameFiles.length} frames`);
        resolve(frameFiles);
      })
      .on('error', (error) => {
        console.error('❌ Error extracting frames:', error);
        reject(error);
      });
  });
};

/**
 * Extract audio from video file
 */
const extractAudio = async (videoPath) => {
  console.log(`🎵 Extracting audio from: ${videoPath}`);
  
  const audioDir = process.env.TEMP_AUDIO_DIR || './temp/audio/';
  await fs.ensureDir(audioDir);
  
  const audioPath = path.join(audioDir, `${uuidv4()}.mp3`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .toFormat('mp3')
      .on('end', () => {
        console.log(`✅ Audio extracted: ${audioPath}`);
        resolve(audioPath);
      })
      .on('error', (error) => {
        console.error('❌ Error extracting audio:', error);
        reject(error);
      })
      .save(audioPath);
  });
};

/**
 * Analyze video frames to generate comprehensive visual description
 */
const analyzeVideoFrames = async (framePaths, transcription = '') => {
  console.log(`🎬 Analyzing ${framePaths.length} video frames for visual context...`);
  
  try {
    // Prepare frame data for analysis
    const frameData = [];
    for (const framePath of framePaths) {
      try {
        const frameBuffer = await fs.readFile(framePath);
        frameData.push({
          inlineData: {
            data: frameBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        });
        } catch (error) {
        console.error(`❌ Error reading frame ${framePath}:`, error);
      }
    }
    
    if (frameData.length === 0) {
      console.log('⚠️ No frames available for analysis');
      return null;
    }
    
    const prompt = `You are an expert video analyst. Analyze these video frames and provide comprehensive visual context that could be relevant for fact-checking.

AUDIO TRANSCRIPTION (if available): "${transcription || 'No transcription available'}"

Please provide a detailed analysis covering:

1. **VISUAL CONTENT**: What do you see in these frames?
2. **TEXT/GRAPHICS**: Any visible text, captions, or graphics in the video?
3. **SETTING/LOCATION**: Where does this appear to be filmed?
4. **PEOPLE**: Who appears in the video? (describe without naming unless text identifies them)
5. **ACTIONS**: What activities or events are shown?
6. **CREDIBILITY INDICATORS**: Does this look like news footage, amateur video, staged content, etc.?
7. **FACT-CHECK RELEVANCE**: What visual elements could help verify or contradict potential claims?

Be specific and factual. Focus on what you can definitively observe.`;

    const { result } = await makeGeminiAPICall(
      MODELS.VISUAL_ANALYSIS,
      GENERATION_CONFIGS.HIGH_ACCURACY, 
      prompt,
      frameData
    );
    
    const videoAnalysis = result.response.text().trim();
    console.log(`✅ Video analysis complete (${videoAnalysis.length} chars)`);
  
  return { 
      frameCount: framePaths.length,
      analysis: videoAnalysis,
      transcriptionIncluded: !!transcription
    };
  } catch (error) {
    console.error('❌ Error analyzing video frames:', error);
    return null;
  }
};

/**
 * Transcribe audio using Gemini AI with enhanced accuracy
 */
const transcribeAudio = async (audioPath) => {
  console.log(`🎤 Transcribing audio: ${audioPath}`);
  
  try {
    // Read audio file as buffer
    const audioBuffer = await fs.readFile(audioPath);
    console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`);
    
    const prompt = `You are a professional transcriptionist with expertise in accurate speech-to-text conversion. Your task is to transcribe this audio file with the highest possible accuracy.

INSTRUCTIONS:
1. Transcribe ALL spoken words exactly as heard
2. Include natural speech patterns (um, uh, etc.) if present
3. Use proper punctuation and capitalization
4. If multiple speakers, indicate with [Speaker 1], [Speaker 2], etc.
5. For unclear words, use [inaudible] rather than guessing
6. Maintain the exact timing and flow of speech
7. Do not add interpretations, summaries, or commentary
8. If background music or sounds interfere, focus only on clear speech

CRITICAL: Return ONLY the transcription text. No prefixes, explanations, or additional commentary.

Audio file to transcribe:`;
    
    const additionalContent = [{
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: 'audio/mp3'
        }
    }];
    
    const { result } = await makeGeminiAPICall(
      MODELS.TRANSCRIPTION,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      prompt,
      additionalContent
    );
    
    const transcription = result.response.text().trim();
    console.log(`✅ Audio transcribed (${transcription.length} chars): ${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}`);
    
    // Basic validation
    if (transcription.length < 3) {
      console.log('⚠️ Very short transcription, audio may be unclear');
    }
    
    return transcription;
  } catch (error) {
    console.error('❌ Error transcribing audio:', error);
    throw error;
  }
};

/**
 * Clean and validate Instagram reel caption
 */
const cleanCaption = (rawCaption) => {
  if (!rawCaption || typeof rawCaption !== 'string') {
    return { cleaned: '', isSignificant: false, removed: [] };
  }

  console.log(`🧼 Cleaning caption: "${rawCaption.substring(0, 100)}${rawCaption.length > 100 ? '...' : ''}"`);

  // Remove hashtags and capture them
  const hashtagMatches = rawCaption.match(/#[\w\u0900-\u097F]+/g) || [];
  let cleaned = rawCaption.replace(/#[\w\u0900-\u097F]+/g, '');

  // Remove extra whitespace and newlines
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();

  // Remove common social media patterns
  const socialPatterns = [
    /@[\w\u0900-\u097F]+/g, // Remove @mentions
    /\b(like|share|comment|follow|subscribe)\b/gi, // Remove CTA words
    /👆|👇|👈|👉|🔥|💯|❤️|😍|🤔|💪|🙏/g, // Remove common emojis
  ];

  socialPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Final cleanup
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Determine if caption is significant enough for fact-checking
  const isSignificant = cleaned.length >= 20 && // At least 20 characters
                       !isOnlyCTA(cleaned) && // Not just promotional text
                       hasSubstantialContent(cleaned); // Contains meaningful content

  console.log(`✅ Caption cleaned: ${cleaned.length} chars, significant: ${isSignificant}`);
  console.log(`🏷️ Removed ${hashtagMatches.length} hashtags: ${hashtagMatches.join(', ')}`);

  return {
    cleaned: cleaned,
    isSignificant: isSignificant,
    removed: hashtagMatches,
    originalLength: rawCaption.length,
    cleanedLength: cleaned.length
  };
};

/**
 * Check if caption is only promotional/CTA content
 */
const isOnlyCTA = (text) => {
  const ctaPatterns = [
    /^(like|share|comment|follow|subscribe|watch|check|visit)/i,
    /(link in bio|swipe up|dm me|contact us)/i,
    /^(what do you think|thoughts|agree)/i
  ];
  
  return ctaPatterns.some(pattern => pattern.test(text.trim()));
};

/**
 * Check if caption has substantial factual content
 */
const hasSubstantialContent = (text) => {
  // Look for indicators of factual content
  const factualIndicators = [
    /\d+/, // Numbers
    /(said|announced|reported|confirmed|denied|stated)/i, // News language
    /(according to|sources|official|government|company)/i, // Authority references
    /(breaking|news|update|latest|just in)/i, // News indicators
    /\b(USD|INR|dollar|rupee|crore|lakh|million|billion)\b/i, // Financial terms
    /\b(died|killed|arrested|acquired|bought|sold|merger|deal)\b/i // Newsworthy events
  ];

  return factualIndicators.some(pattern => pattern.test(text));
};

/**
 * Extract verifiable claim from video content using AI with enhanced context
 */
const extractClaim = async (transcription, rawCaption = '', videoAnalysis = null) => {
  console.log(`🧠 Extracting verifiable claim from comprehensive content...`);
  
  // Clean and validate caption
  const captionInfo = cleanCaption(rawCaption);
  const caption = captionInfo.cleaned;
  
  console.log(`📝 Caption analysis: ${captionInfo.cleanedLength}/${captionInfo.originalLength} chars, significant: ${captionInfo.isSignificant}`);

  const prompt = `You are a fact-checking expert. Extract the most important FACTUAL CLAIM from this Instagram reel content.

**CAPTION TEXT**: "${caption || 'No caption'}"
**AUDIO TRANSCRIPTION**: "${transcription || 'No transcription available'}"
**VISUAL ANALYSIS**: "${videoAnalysis?.analysis || 'No visual analysis available'}"

**CAPTION IS ${captionInfo.isSignificant ? 'SIGNIFICANT' : 'NOT SIGNIFICANT'}** - ${captionInfo.isSignificant ? 'Give high priority to caption content' : 'Focus more on audio/video content'}

${captionInfo.removed.length > 0 ? `**REMOVED HASHTAGS**: ${captionInfo.removed.join(', ')}` : ''}

**CONTENT PRIORITIZATION**:
${captionInfo.isSignificant ? 
  '1. **CAPTION FIRST** - Extract claims primarily from caption text\n2. **AUDIO SECOND** - Use transcription to support/clarify caption\n3. **VISUAL THIRD** - Use visual analysis for context' :
  '1. **AUDIO FIRST** - Focus on spoken claims from transcription\n2. **VISUAL SECOND** - Use visual cues and context\n3. **CAPTION THIRD** - Caption is not substantial enough for primary claims'}

TASK: Find the single most important factual claim that can be verified. This should be:
1. **A specific statement** about events, people, numbers, or facts
2. **Verifiable** - something that can be checked against news sources  
3. **Important** - the main point of the content, not minor details

EXAMPLES OF GOOD CLAIMS:
- "H1B visa fees increased to $100,000 annually"
- "Adani bought land for 1 rupee per year" 
- "Person X died yesterday"
- "Company Y acquired Company Z for $1 billion"
- "Government announced new policy on immigration"

EXAMPLES TO IGNORE:
- Opinions like "This policy is bad" 
- Vague statements like "Things are getting worse"
- Questions like "What do you think?"
- Pure promotional content like "Like and subscribe"

**IMPORTANT**: If the caption contains substantial factual information, prioritize it over audio transcription.

If NO verifiable factual claim is found in any content, return: "No verifiable claim found"

OUTPUT: Return only the extracted claim as plain text, nothing else.`;

  try {
    const { result } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      prompt
    );
    
    const extractedClaim = result.response.text().trim();
    
    console.log(`✅ Extracted claim: "${extractedClaim}"`);
    return extractedClaim;
    
  } catch (error) {
    console.log(`❌ Claim extraction failed: ${error.message}`);
    return 'No verifiable claim found';
  }
};

/**
 * Cleanup temporary files
 */
const cleanupFiles = async (...filePaths) => {
  console.log(`🧹 Cleaning up temporary files...`);
  
  for (const filePath of filePaths) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.log(`✅ Deleted: ${filePath}`);
    }
  } catch (error) {
      console.error(`❌ Error deleting ${filePath}:`, error.message);
    }
  }
};

/**
 * Extract claim from Instagram reel caption using AI (LEGACY - kept for compatibility)
 */
const extractClaimFromReel = async (caption, videoUrl = '') => {
  console.log(`🧠 Extracting claim from Instagram reel...`);
  
  if (!caption || caption.length < 10) {
    console.log(`⚠️ Caption too short or empty`);
    return 'No verifiable claim found';
  }
  
  const prompt = `Extract the most important FACTUAL CLAIM from this Instagram reel caption.

CAPTION: "${caption}"

TASK: Find a specific factual statement that can be verified. Look for:
- Claims about events, people, companies, numbers
- News-worthy statements  
- Specific allegations or facts

EXAMPLES OF GOOD CLAIMS:
- "Adani bought land for 1 rupee"
- "Person X died yesterday"
- "Company Y acquired Company Z"

AVOID:
- Opinions ("This is bad")
- Questions ("What do you think?")
- Vague statements ("Things are getting worse")

If no clear factual claim is found, return: "No verifiable claim found"

OUTPUT: Return only the extracted claim as plain text.`;

  try {
    const { result } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      prompt
    );
    
    const claim = result.response.text().trim();
    console.log(`✅ Extracted claim: "${claim}"`);
    return claim;
    
  } catch (error) {
    console.log(`❌ Claim extraction failed: ${error.message}`);
    return 'No verifiable claim found';
  }
};

/**
 * COMPREHENSIVE: Process Instagram reel with full video/audio analysis + Google Custom Search
 */
const processInstagramReel = async (senderId, attachment) => {
  const reelId = uuidv4().substring(0, 8);
  
  console.log(`🎬 [${reelId}] COMPREHENSIVE Instagram reel processing for user: ${senderId}`);
  console.log(`📱 [${reelId}] Video + Audio + Google Custom Search (no Reddit, no broken APIs)`);
  console.log(`📦 [${reelId}] Attachment data:`, JSON.stringify(attachment, null, 2));
  
  if (!attachment || typeof attachment !== 'object') {
    throw new Error(`[${reelId}] Invalid attachment: attachment is ${typeof attachment}`);
  }
  
  if (attachment.type !== 'ig_reel') {
    throw new Error(`[${reelId}] Invalid attachment type: expected 'ig_reel', got '${attachment.type}'`);
  }
  
  if (!attachment.payload) {
    throw new Error(`[${reelId}] Invalid attachment: missing payload`);
  }
  
  if (!attachment.payload.url) {
    console.error(`[${reelId}] Missing video URL in payload:`, JSON.stringify(attachment.payload, null, 2));
    throw new Error(`[${reelId}] Invalid Instagram reel attachment: missing URL in payload`);
  }
  
  const videoUrl = attachment.payload.url;
  const rawCaption = attachment.payload.title || '';
  const fileName = `${reelId}_${uuidv4()}.mp4`;
  
  console.log(`📱 [${reelId}] Video URL: ${videoUrl}`);
  console.log(`📝 [${reelId}] Raw Caption (${rawCaption.length} chars): "${rawCaption.substring(0, 150)}${rawCaption.length > 150 ? '...' : ''}"`);
  
  // Clean and analyze caption early to determine processing strategy
  const captionInfo = cleanCaption(rawCaption);
  console.log(`🧼 [${reelId}] Caption Analysis:`);
  console.log(`   - Original: ${captionInfo.originalLength} chars`);
  console.log(`   - Cleaned: ${captionInfo.cleanedLength} chars`);
  console.log(`   - Significant: ${captionInfo.isSignificant ? 'YES' : 'NO'}`);
  console.log(`   - Hashtags removed: ${captionInfo.removed.length}`);
  
  if (captionInfo.isSignificant) {
    console.log(`✨ [${reelId}] CAPTION-PRIORITY processing: Caption contains substantial factual content`);
  } else {
    console.log(`🎵 [${reelId}] AUDIO-PRIORITY processing: Caption not significant, focusing on audio/video`);
  }
  
  let videoPath = null;
  let audioPath = null;
  let framePaths = [];
  
  try {
    // STEP 1: Download video
    console.log(`⬇️ [${reelId}] Downloading video...`);
    videoPath = await downloadVideo(videoUrl, fileName);
    
    // STEP 2: Extract audio and video frames in parallel 
    console.log(`🔄 [${reelId}] Extracting audio and video frames in parallel...`);
    const [audioPath_result, framePaths_result] = await Promise.all([
      extractAudio(videoPath),
      extractVideoFrames(videoPath, 5)
    ]);
    audioPath = audioPath_result;
    framePaths = framePaths_result;
    
    // STEP 3: Transcribe audio and analyze video frames in parallel
    console.log(`🎤 [${reelId}] Transcribing audio and analyzing video frames...`);
    const [transcription, videoAnalysis] = await Promise.all([
      transcribeAudio(audioPath),
      analyzeVideoFrames(framePaths)
    ]);
    
    console.log(`✅ [${reelId}] Transcription (${transcription.length} chars): "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}"`);
    console.log(`✅ [${reelId}] Video analysis: ${videoAnalysis ? 'COMPLETE' : 'FAILED'}`);
    
    // STEP 4: Extract claim with full context (audio + video + caption)
    console.log(`🧠 [${reelId}] Extracting verifiable claim from ALL content...`);
    const claim = await extractClaim(transcription, rawCaption, videoAnalysis);
    
    if (claim === 'No verifiable claim found') {
      console.log(`❌ [${reelId}] No verifiable claims found in video`);
      console.log(`📊 [${reelId}] Content Summary: Caption(${captionInfo.isSignificant ? 'significant' : 'not significant'}), Audio(${transcription.length} chars), Video(${videoAnalysis ? 'analyzed' : 'failed'})`);
      return {
        success: false,
        message: 'No verifiable claims found in this video to fact-check.',
        claim: claim,
        transcription: transcription,
        videoAnalysis: videoAnalysis,
        captionInfo: captionInfo,
        reelId: reelId
      };
    }
    
    console.log(`✅ [${reelId}] Extracted claim: "${claim}"`);
    
    // STEP 5: Check vector cache for similar claims (DISABLED FOR PERFORMANCE)
    let cachedResult = null;
    let cacheHit = false;
    let similarClaim = null;
    
    // Vector cache is disabled for performance - skip all cache operations
    if (ENABLE_VECTOR_CACHE && vectorCache.isReady()) {
      console.log(`🔍 [${reelId}] Checking vector cache for similar claims...`);
      try {
        // Set a timeout to prevent hanging
        const cacheCheck = Promise.race([
          vectorCache.searchSimilarClaims(claim, transcription, rawCaption),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Vector cache timeout')), 5000))
        ]);
        
        similarClaim = await cacheCheck;
        
        if (similarClaim && !similarClaim.stale) {
          // Fresh cached result found
          console.log(`[VECTOR_CACHE] Returning cached result (fresh, similarity: ${similarClaim.similarity.toFixed(3)})`);
          cachedResult = similarClaim.payload.fact_check_result;
          cacheHit = true;
        } else if (similarClaim && similarClaim.stale) {
          console.log(`[VECTOR_CACHE] Similar claim found but stale (${similarClaim.ageMinutes}min old), running fresh fact-check`);
        } else {
          console.log(`[VECTOR_CACHE] No similar claims found, running fresh fact-check`);
        }
      } catch (error) {
        console.log(`[VECTOR_CACHE] Skipping cache check (non-blocking): ${error.message}, running fresh fact-check`);
        // Continue without cache - don't throw error
      }
    } else {
      if (!ENABLE_VECTOR_CACHE) {
        console.log(`⚡ [${reelId}] Vector cache disabled for performance, running fresh fact-check`);
      } else {
        console.log(`[VECTOR_CACHE] Vector cache not ready, running fresh fact-check`);
      }
    }
    
    let factCheckResults = [];
    let analysis = null;
    
    if (cacheHit && cachedResult) {
      // Use cached result
      analysis = cachedResult;
      console.log(`✅ [${reelId}] Using cached fact-check result: ${analysis.verdict} (${analysis.confidence})`);
    } else {
      // STEP 6: Fact-check using ONLY Google Custom Search + AI  
      console.log(`🔍 [${reelId}] Fact-checking with Google Custom Search...`);
      factCheckResults = await searchFactChecks(claim);
      
      if (factCheckResults.length === 0) {
        console.log(`⚠️ [${reelId}] No sources found for fact-checking`);
        return {
          success: false,
          message: 'No reliable sources found to verify this claim.',
          claim: claim,
          transcription: transcription,
          videoAnalysis: videoAnalysis,
          captionInfo: captionInfo,
          reelId: reelId
        };
      }
      
      console.log(`📊 [${reelId}] Found ${factCheckResults.length} sources, analyzing...`);
      
      // STEP 7: Enhanced analysis with video context
      analysis = await analyzeFactChecks(factCheckResults, claim);
    }
    
    console.log(`✅ [${reelId}] COMPLETE: ${analysis.verdict} (${analysis.confidence})`);
    
    // STEP 8: Store in vector cache (DISABLED FOR PERFORMANCE)
    if (ENABLE_VECTOR_CACHE && !cacheHit && vectorCache.isReady()) {
      try {
        // Set a timeout to prevent hanging
        const storeCache = Promise.race([
          vectorCache.storeFactCheck(claim, transcription, rawCaption, analysis, senderId, reelId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Vector cache store timeout')), 5000))
        ]);
        
        await storeCache;
        console.log(`[VECTOR_CACHE] ✅ Stored new fact-check in vector database`);
      } catch (error) {
        console.log(`[VECTOR_CACHE] Skipping cache storage (non-blocking): ${error.message}`);
        // Continue without storing in cache - don't throw error
      }
    } else if (!ENABLE_VECTOR_CACHE) {
      // Vector cache disabled - skip silently for performance
    }
    
    // STEP 9: Store comprehensive result in user history
    const factCheckRecord = {
      userId: senderId,
      result: {
        claim: claim,
        analysis: analysis,
        transcription: transcription,
        videoAnalysis: videoAnalysis,
        captionInfo: captionInfo,
        rawCaption: rawCaption
      },
      timestamp: Date.now(),
      reelId: reelId
    };
    
    if (!factCheckMemory.has(senderId)) {
      factCheckMemory.set(senderId, []);
    }
    const userHistory = factCheckMemory.get(senderId);
    userHistory.push(factCheckRecord);
    
    // Keep last 50 records
    if (userHistory.length > 50) {
      userHistory.splice(0, userHistory.length - 50);
    }
    
    console.log(`💾 [${reelId}] Stored comprehensive result in user history`);
    
    return {
      success: true,
      claim: claim,
      transcription: transcription,
      videoAnalysis: videoAnalysis,
      captionInfo: captionInfo,
      analysis: analysis,
      sources: factCheckResults.length,
      reelId: reelId,
      cached: cacheHit,
      cacheAge: cacheHit ? Math.floor((Date.now() - (similarClaim?.payload?.metadata?.created_at || Date.now())) / 1000) : null,
      similarity: cacheHit ? similarClaim?.similarity : null
    };
    
  } catch (error) {
    console.error(`❌ [${reelId}] Error processing reel:`, error);
    throw error;
  } finally {
    // STEP 8: Cleanup temporary files
    const filesToCleanup = [videoPath, audioPath, ...framePaths].filter(Boolean);
    if (filesToCleanup.length > 0) {
      console.log(`🧹 [${reelId}] Cleaning up ${filesToCleanup.length} temporary files...`);
      await cleanupFiles(...filesToCleanup);
    }
  }
};

// Export the comprehensive functions for the Instagram webhook
module.exports = {
  searchFactChecks,
  analyzeFactChecks,
  processInstagramReel,  // NEW: Comprehensive version with video/audio analysis + Google Custom Search + Vector Cache
  makeGeminiAPICall,
  // Video/Audio processing functions
  downloadVideo,
  extractAudio,
  extractVideoFrames,
  transcribeAudio,
  analyzeVideoFrames,
  extractClaim,
  cleanupFiles,
  // Compatibility functions
  getUserFactCheckHistory: (userId) => factCheckMemory.get(userId) || [],
  generateDetailedExplanation: async (claim, analysis) => {
    console.log(`🔍 Generating detailed explanation for: "${claim}"`);
    
    try {
      const prompt = `Create a SHORT, Instagram-friendly detailed explanation for this fact-check result.

CLAIM: "${claim}"
VERDICT: ${analysis.verdict} 
CONFIDENCE: ${analysis.confidence}

REQUIREMENTS:
1. **KEEP IT SHORT** - Maximum 500 characters total
2. **Explain WHY** - Brief reason for the verdict
3. **Mention sources** - What type of sources were checked
4. **Instagram tone** - Casual, friendly, emoji-friendly
5. **No academic language** - Keep it conversational

EXAMPLES:
❌ FALSE: "Multiple news outlets contradict this. Official government sources show different numbers. This appears to be misinformation spreading on social media."

✅ TRUE: "Confirmed by major news outlets and official sources. The core facts check out, though some details may vary slightly."

⚠️ MIXED: "Some parts are accurate but others are misleading. Different reliable sources give conflicting information."

Generate a concise explanation (under 500 chars):`;

      const { result } = await makeGeminiAPICall(
        MODELS.CLAIM_ANALYSIS,
        GENERATION_CONFIGS.HIGH_ACCURACY,
        prompt
      );

      const detailedResponse = result.response.text().trim();
      console.log(`✅ Generated detailed explanation (${detailedResponse.length} chars)`);
      
      return {
        found: true, 
        response: detailedResponse
      };
      
    } catch (error) {
      console.error('❌ Error generating detailed explanation:', error);
      
      // Concise fallback response for Instagram
      let fallback = '';
      if (analysis.verdict === 'True') {
        fallback = '✅ Multiple reliable sources confirm this is accurate.';
      } else if (analysis.verdict === 'False') {
        fallback = '❌ Authoritative sources contradict this claim.';
      } else {
        fallback = '⚠️ Sources give mixed information on this topic.';
      }
      
      fallback += ` ${analysis.confidence} confidence based on my search.`;

      return {
        found: true,
        response: fallback
      };
    }
  },
  generateGeneralConversation: async (userId, message) => ({ 
    found: true, 
    response: "👋 I'm a fact-checking bot! Share a reel with news/claims and I'll verify it for you. You can also ask about previous fact-checks! 🔍" 
  }),
  generateConversationalResponse: async (userId, query, checks) => ({ 
    found: true, 
    response: checks.length > 0 ? `Found ${checks.length} previous fact-checks! What do you want to know? 🤔` : "No fact-checks yet. Share a reel to get started! 🚀" 
  }),
  searchFactCheckMemory: async (userId, query) => {
    const history = factCheckMemory.get(userId) || [];
    return history.filter(check => 
      check.result.claim.toLowerCase().includes(query.toLowerCase()) ||
      check.result.analysis.summary?.toLowerCase().includes(query.toLowerCase()) ||
      (check.result.transcription && check.result.transcription.toLowerCase().includes(query.toLowerCase()))
    );
  }
};
