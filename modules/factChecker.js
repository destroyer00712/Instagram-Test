const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cheerio = require('cheerio');

// Initialize Gemini AI with Pro model for better accuracy
console.log('🔑 Initializing Gemini AI...');
console.log('🔑 GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('🔑 GEMINI_API_KEY length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined');
console.log('🔑 GEMINI_API_KEY first 10 chars:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'undefined');
console.log('🔑 GEMINI_API_KEY last 10 chars:', process.env.GEMINI_API_KEY ? '...' + process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 10) : 'undefined');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Helper function to make Gemini API calls with automatic quota fallback
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
    // If Pro model fails with quota error, automatically try Flash
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
      // Re-throw if it's not a quota error or not a Pro model
      throw error;
    }
  }
};

// Model configurations for different tasks
const MODELS = {
  TRANSCRIPTION: 'gemini-1.5-pro', // Best for audio transcription
  CLAIM_ANALYSIS: 'gemini-1.5-pro', // Best for complex reasoning
  VIDEO_ANALYSIS: 'gemini-1.5-pro', // Best for video frame analysis
  LOGICAL_CONSISTENCY: 'gemini-1.5-pro', // For logical consistency checking
  FALLBACK: 'gemini-2.0-flash-exp' // Latest and faster fallback model
};

// Enhanced generation configs
const GENERATION_CONFIGS = {
  HIGH_ACCURACY: {
    temperature: 0.1,
    maxOutputTokens: 2048,
    topP: 0.8,
    topK: 20
  },
  BALANCED: {
    temperature: 0.2,
    maxOutputTokens: 1024,
    topP: 0.9,
    topK: 40
  }
};

// In-memory storage for fact-check results
// In production, use a database like MongoDB or Redis
const factCheckMemory = new Map();

// Cache for scraped article content to avoid re-scraping
const articleContentCache = new Map();

// Cache for Reddit search results
const redditSearchCache = new Map();

// Logical consistency patterns for weighting
const LOGICAL_INCONSISTENCY_PATTERNS = [
  'contradicts',
  'inconsistent with',
  'conflicts with',
  'opposite to',
  'disputed by',
  'refuted by',
  'debunked by',
  'proven false',
  'factually incorrect'
];

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
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Video downloaded: ${filePath}`);
        resolve(filePath);
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error downloading video:', error);
    throw error;
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
        console.warn(`⚠️ Could not read frame ${framePath}:`, error.message);
      }
    }
    
    if (frameData.length === 0) {
      console.log('❌ No valid frames to analyze');
      return null;
    }
    
    const prompt = `You are an expert video analyst specializing in creating comprehensive audio descriptions for accessibility and fact-checking purposes. Analyze these video frames and provide a detailed visual description.

TRANSCRIBED AUDIO: "${transcription}"

ANALYSIS REQUIREMENTS:
1. **Visual Scene Description**: Describe what you see in each frame - people, objects, settings, text overlays, graphics
2. **Context Analysis**: How do the visuals relate to the audio content?
3. **Credibility Indicators**: Look for signs of authenticity or manipulation (editing artifacts, inconsistencies, watermarks, source indicators)
4. **Text and Graphics**: Transcribe any visible text, captions, headlines, or graphics
5. **People and Actions**: Describe people's appearance, actions, expressions, and any identifying features
6. **Setting and Environment**: Describe the location, time indicators, background elements
7. **Production Quality**: Assess video quality, lighting, camera work that might indicate source credibility

LOGICAL CONSISTENCY CHECK:
- Do the visuals support or contradict the audio claims?
- Are there any logical inconsistencies between what's said and what's shown?
- Note any red flags or suspicious elements

OUTPUT FORMAT:
{
  "visual_description": "Comprehensive description of what is shown in the video",
  "audio_visual_alignment": "How well the visuals align with the audio content",
  "credibility_indicators": ["list", "of", "credibility", "signals"],
  "text_elements": ["visible", "text", "and", "graphics"],
  "logical_consistency": "Assessment of logical consistency between audio and video",
  "red_flags": ["any", "suspicious", "elements"],
  "production_assessment": "Quality and authenticity assessment"
}

Provide ONLY the JSON response:`;
    
    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.VIDEO_ANALYSIS,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      [prompt, ...frameData]
    );
    
    const analysisText = result.response.text().trim();
    
    try {
      const analysis = JSON.parse(analysisText);
      console.log(`✅ Video analysis completed with ${frameData.length} frames`);
      return analysis;
    } catch (jsonError) {
      console.log(`⚠️ JSON parse failed for video analysis, using fallback`);
      return {
        visual_description: analysisText,
        audio_visual_alignment: "Unable to parse detailed alignment",
        credibility_indicators: [],
        text_elements: [],
        logical_consistency: "Analysis parsing failed",
        red_flags: [],
        production_assessment: "Unable to assess"
      };
    }
    
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
  
  // Log API key info for debugging
  console.log('🔑 [transcribeAudio] API Key Debug:');
  console.log('🔑 [transcribeAudio] GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
  console.log('🔑 [transcribeAudio] API Key length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'undefined');
  console.log('🔑 [transcribeAudio] API Key preview:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 15) + '...' + process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 15) : 'undefined');
  
  try {
    // Read audio file as buffer
    const audioBuffer = await fs.readFile(audioPath);
    console.log(`📊 [transcribeAudio] Audio buffer size: ${audioBuffer.length} bytes`);
    
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
    
    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.TRANSCRIPTION,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      prompt,
      additionalContent
    );
    
    const transcription = result.response.text().trim();
    console.log(`✅ Audio transcribed using ${modelUsed} (${transcription.length} chars): ${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}`);
    
    // Basic validation
    if (transcription.length < 3) {
      console.log('⚠️ Very short transcription, audio may be unclear');
    }
    
    return transcription;
  } catch (error) {
    console.error('❌ Error transcribing audio:', error);
    
    // Additional debugging for API key issues
    if (error.message && error.message.includes('quota')) {
      console.log('🔍 [ERROR DEBUG] Quota exceeded error detected');
      console.log('🔑 [ERROR DEBUG] Current GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'EXISTS' : 'MISSING');
      console.log('🔑 [ERROR DEBUG] API Key length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 'N/A');
      console.log('🔑 [ERROR DEBUG] API Key starts with:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) : 'N/A');
      console.log('🔑 [ERROR DEBUG] API Key ends with:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 20) : 'N/A');
      
      // Test a simple API call to verify the key
      try {
        console.log('🧪 [ERROR DEBUG] Testing API key with simple call...');
        const testModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const testResult = await testModel.generateContent('Test');
        console.log('✅ [ERROR DEBUG] API key test successful with 2.0 Flash');
      } catch (testError) {
        console.log('❌ [ERROR DEBUG] API key test failed:', testError.message);
      }
    }
    
    throw error;
  }
};

/**
 * Check logical consistency of claims and evidence
 */
const checkLogicalConsistency = async (claim, videoAnalysis, factCheckResults) => {
  console.log(`🧠 Checking logical consistency for claim: ${claim.substring(0, 100)}...`);
  
  try {
    // Prepare evidence from fact-check results
    let evidenceText = '';
    if (factCheckResults?.claims?.length > 0) {
      evidenceText = factCheckResults.claims.slice(0, 3).map(claim => {
        const review = claim.claimReview?.[0];
        return review ? `${review.publisher?.name}: ${review.textualRating}` : '';
      }).filter(Boolean).join('; ');
    }
    
    const visualConsistency = videoAnalysis ? videoAnalysis.logical_consistency : 'No video analysis available';
    const redFlags = videoAnalysis ? videoAnalysis.red_flags.join(', ') : 'None identified';
    
    const prompt = `You are an expert logical reasoning analyst specializing in detecting inconsistencies and contradictions in claims and evidence. Analyze the following information for logical consistency.

CLAIM TO ANALYZE: "${claim}"

VISUAL ANALYSIS: "${visualConsistency}"
RED FLAGS DETECTED: "${redFlags}"
FACT-CHECK EVIDENCE: "${evidenceText}"

LOGICAL CONSISTENCY ANALYSIS:
1. **Internal Consistency**: Are there contradictions within the claim itself?
2. **Evidence Alignment**: Do the visual elements support or contradict the claim?
3. **Source Credibility**: Are there signs of manipulation or unreliable sourcing?
4. **Logical Fallacies**: Identify any logical fallacies in the claim's structure
5. **Contradiction Detection**: Find specific contradictions between claim and evidence

SCORING CRITERIA:
- HIGH_CONSISTENCY (0.8-1.0): All elements align logically, no contradictions
- MEDIUM_CONSISTENCY (0.5-0.7): Minor inconsistencies or missing context
- LOW_CONSISTENCY (0.2-0.4): Significant contradictions or logical flaws
- VERY_LOW_CONSISTENCY (0.0-0.1): Major contradictions, likely false

OUTPUT FORMAT:
{
  "consistency_score": 0.0-1.0,
  "consistency_level": "HIGH|MEDIUM|LOW|VERY_LOW",
  "contradictions_found": ["list", "of", "specific", "contradictions"],
  "logical_fallacies": ["identified", "fallacies"],
  "evidence_alignment": "How well evidence supports the claim",
  "credibility_assessment": "Overall credibility based on logical analysis",
  "weight_adjustment": -0.3 to 0.3 (adjustment to apply to final verdict)
}

Provide ONLY the JSON response:`;
    
    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.LOGICAL_CONSISTENCY,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      prompt
    );
    
    const analysisText = result.response.text().trim();
    
    try {
      const analysis = JSON.parse(analysisText);
      console.log(`✅ Logical consistency analysis: ${analysis.consistency_level} (${analysis.consistency_score})`);
      return analysis;
    } catch (jsonError) {
      console.log(`⚠️ JSON parse failed for logical consistency, using fallback`);
      return {
        consistency_score: 0.5,
        consistency_level: "MEDIUM",
        contradictions_found: [],
        logical_fallacies: [],
        evidence_alignment: "Unable to parse analysis",
        credibility_assessment: "Analysis parsing failed",
        weight_adjustment: 0.0
      };
    }
    
  } catch (error) {
    console.error('❌ Error in logical consistency check:', error);
    return {
      consistency_score: 0.5,
      consistency_level: "MEDIUM",
      contradictions_found: [],
      logical_fallacies: [],
      evidence_alignment: "Analysis failed",
      credibility_assessment: "Unable to assess",
      weight_adjustment: 0.0
    };
  }
};

/**
 * Extract claim from transcription and caption using Gemini AI
 */
const extractClaim = async (transcription, caption) => {
  console.log(`🧠 Extracting claim from content...`);
  
  try {
    const prompt = `You are an expert fact-checker and media analyst specializing in identifying verifiable claims in social media content. Your task is to extract the PRIMARY factual claim that can be objectively verified.

CONTENT TO ANALYZE:
Transcription: "${transcription}"
Caption: "${caption}"

CLAIM IDENTIFICATION CRITERIA:
✅ INCLUDE these types of claims:
- Statements about specific events that occurred
- Claims about people's actions, deaths, injuries, or statements
- Statistical data or numbers
- Claims about policies, laws, or official decisions  
- Historical facts or dates
- Scientific or medical claims
- Economic data or business information
- Geographic or location-based facts

❌ EXCLUDE these (NOT verifiable claims):
- Personal opinions or subjective statements
- Predictions about future events
- Religious or philosophical beliefs
- Artistic or creative expressions
- Emotional reactions or feelings
- General commentary without specific facts
- Jokes, sarcasm, or clearly humorous content
- Promotional content without factual assertions

ANALYSIS PROCESS:
1. Read through all content carefully
2. Identify all potential factual statements
3. Filter out opinions, predictions, and non-verifiable content
4. Select the most significant, specific, and verifiable claim
5. Formulate as a clear, searchable statement

OUTPUT REQUIREMENTS:
- Return ONLY the extracted claim as a single, clear sentence
- Make it specific and searchable (include names, dates, places if mentioned)
- Use neutral, factual language
- Remove unnecessary qualifiers or emotional language
- If NO verifiable claim exists, return exactly: "No verifiable claim found"

Examples of GOOD claim extraction:
❌ Original: "OMG Charlie Kirk is such a terrible person and I heard he got shot!"
✅ Extracted: "Charlie Kirk was shot"

❌ Original: "I think the government should do something about inflation which is probably getting worse"
✅ Extracted: "No verifiable claim found"

❌ Original: "Breaking: Studies show that 75% of Americans support this new policy according to recent polls"
✅ Extracted: "75% of Americans support new policy according to recent polls"

Now extract the PRIMARY verifiable claim:`;
    
    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      prompt
    );
    
    const claim = result.response.text().trim();
    console.log(`✅ Extracted claim using ${modelUsed}: ${claim}`);
    
    // Enhanced validation of the claim extraction
    if (claim.toLowerCase().includes('no verifiable claim') || 
        claim.toLowerCase().includes('no factual claim') ||
        claim.length < 10 || 
        claim.toLowerCase().includes('opinion') ||
        claim.toLowerCase().includes('subjective')) {
      console.log('📝 No verifiable factual claims identified');
      return "No verifiable claim found";
    }
    
    // Additional quality checks
    if (claim.length > 200) {
      console.log('⚠️ Claim seems too long, may need refinement');
    }
    
    return claim;
  } catch (error) {
    console.error('❌ Error extracting claim:', error);
    throw error;
  }
};

/**
 * Search Reddit for news verification and public sentiment
 */
const searchRedditForVerification = async (claim) => {
  console.log(`🔍 Searching Reddit for verification of: ${claim.substring(0, 50)}...`);
  
  // Check cache first
  const cacheKey = `reddit_${claim.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  if (redditSearchCache.has(cacheKey)) {
    console.log('📋 Using cached Reddit results');
    return redditSearchCache.get(cacheKey);
  }
  
  try {
    // Extract key terms from claim for better search
    const searchTerms = claim
      .replace(/[^\w\s]/g, ' ')
      .split(' ')
      .filter(word => word.length > 3 && !['this', 'that', 'with', 'from', 'they', 'were', 'been', 'have'].includes(word.toLowerCase()))
      .slice(0, 5)
      .join(' ');
    
    console.log(`🔎 Reddit search terms: "${searchTerms}"`);
    
    // Search multiple relevant subreddits
    const subreddits = [
      'news',
      'worldnews', 
      'politics',
      'factcheck',
      'skeptic',
      'OutOfTheLoop',
      'explainlikeimfive',
      'todayilearned'
    ];
    
    const allResults = [];
    
    for (const subreddit of subreddits.slice(0, 4)) { // Limit to 4 subreddits to avoid rate limits
      try {
        const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json`;
        const params = {
          q: searchTerms,
          sort: 'relevance',
          limit: 10,
          t: 'month' // Last month for recent discussions
        };
        
        const response = await axios.get(searchUrl, {
          params,
          headers: {
            'User-Agent': 'FactChecker/1.0 (Educational Research)'
          },
          timeout: 10000
        });
        
        if (response.data?.data?.children) {
          const posts = response.data.data.children
            .map(child => child.data)
            .filter(post => post.title && post.selftext !== '[removed]')
            .slice(0, 5); // Top 5 posts per subreddit
          
          posts.forEach(post => {
            allResults.push({
              subreddit: post.subreddit,
              title: post.title,
              selftext: post.selftext || '',
              score: post.score,
              num_comments: post.num_comments,
              created_utc: post.created_utc,
              url: `https://reddit.com${post.permalink}`,
              upvote_ratio: post.upvote_ratio
            });
          });
          
          console.log(`  ✅ Found ${posts.length} posts in r/${subreddit}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`  ⚠️ Error searching r/${subreddit}:`, error.message);
      }
    }
    
    // Sort by relevance score (combination of upvotes and comments)
    allResults.sort((a, b) => {
      const scoreA = (a.score * 0.7) + (a.num_comments * 0.3);
      const scoreB = (b.score * 0.7) + (b.num_comments * 0.3);
      return scoreB - scoreA;
    });
    
    const result = {
      total_posts: allResults.length,
      posts: allResults.slice(0, 10), // Top 10 most relevant
      search_terms: searchTerms,
      searched_subreddits: subreddits.slice(0, 4)
    };
    
    // Cache results for 1 hour
    redditSearchCache.set(cacheKey, result);
    setTimeout(() => redditSearchCache.delete(cacheKey), 3600000);
    
    console.log(`✅ Reddit search completed: ${result.total_posts} posts found`);
    return result;
    
  } catch (error) {
    console.error('❌ Error searching Reddit:', error);
    return {
      total_posts: 0,
      posts: [],
      search_terms: '',
      searched_subreddits: [],
      error: error.message
    };
  }
};

/**
 * Analyze Reddit sentiment and verification
 */
const analyzeRedditSentiment = async (redditResults, originalClaim) => {
  if (!redditResults.posts || redditResults.posts.length === 0) {
    return {
      sentiment: 'NEUTRAL',
      confidence: 0.0,
      verification_signals: [],
      community_consensus: 'No data available'
    };
  }
  
  console.log(`📊 Analyzing Reddit sentiment from ${redditResults.posts.length} posts...`);
  
  try {
    // Prepare Reddit content for analysis
    const redditContent = redditResults.posts.slice(0, 5).map(post => 
      `Title: ${post.title}\nSubreddit: r/${post.subreddit}\nScore: ${post.score}\nComments: ${post.num_comments}\nContent: ${post.selftext.substring(0, 300)}`
    ).join('\n\n---\n\n');
    
    const prompt = `You are analyzing Reddit discussions to assess public sentiment and verification signals about a specific claim. Analyze the community response and fact-checking signals.

ORIGINAL CLAIM: "${originalClaim}"

REDDIT DISCUSSIONS:
${redditContent}

ANALYSIS REQUIREMENTS:
1. **Sentiment Analysis**: What is the overall community sentiment toward this claim?
2. **Verification Signals**: Are there signs that the community has fact-checked or verified this claim?
3. **Credibility Indicators**: Look for references to credible sources, fact-checkers, or expert opinions
4. **Misinformation Patterns**: Identify if the community is actively debunking or supporting the claim
5. **Community Consensus**: What appears to be the general consensus?

SENTIMENT CATEGORIES:
- STRONGLY_SUPPORTS: Community strongly believes the claim is true
- SUPPORTS: Community generally believes the claim
- NEUTRAL: Mixed or unclear sentiment
- SKEPTICAL: Community questions or doubts the claim  
- DEBUNKS: Community actively contradicts or debunks the claim

OUTPUT FORMAT:
{
  "sentiment": "STRONGLY_SUPPORTS|SUPPORTS|NEUTRAL|SKEPTICAL|DEBUNKS",
  "confidence": 0.0-1.0,
  "verification_signals": ["signals", "found", "in", "discussions"],
  "community_consensus": "Summary of what the community generally believes",
  "credible_sources_mentioned": ["any", "credible", "sources", "referenced"],
  "misinformation_flags": ["signs", "of", "misinformation", "discussion"]
}

Provide ONLY the JSON response:`;
    
    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      prompt
    );
    
    const analysisText = result.response.text().trim();
    
    try {
      const analysis = JSON.parse(analysisText);
      console.log(`✅ Reddit sentiment analysis: ${analysis.sentiment} (${analysis.confidence})`);
      return analysis;
    } catch (jsonError) {
      console.log(`⚠️ JSON parse failed for Reddit sentiment, using fallback`);
      return {
        sentiment: 'NEUTRAL',
        confidence: 0.3,
        verification_signals: [],
        community_consensus: 'Unable to parse analysis',
        credible_sources_mentioned: [],
        misinformation_flags: []
      };
    }
    
  } catch (error) {
    console.error('❌ Error analyzing Reddit sentiment:', error);
    return {
      sentiment: 'NEUTRAL',
      confidence: 0.0,
      verification_signals: [],
      community_consensus: 'Analysis failed',
      credible_sources_mentioned: [],
      misinformation_flags: []
    };
  }
};

/**
 * Detect video age from metadata or URL patterns to optimize search strategy
 */
const detectVideoAge = (videoUrl, caption = '') => {
  console.log(`📅 Attempting to detect video age from metadata...`);
  
  try {
    // Look for date patterns in caption or URL
    const datePatterns = [
      /(\d{4})-(\d{1,2})-(\d{1,2})/g, // YYYY-MM-DD
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // MM/DD/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/g, // MM-DD-YYYY
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi, // Month DD, YYYY
    ];
    
    const textToSearch = `${caption} ${videoUrl}`;
    let detectedDate = null;
    
    for (const pattern of datePatterns) {
      const matches = textToSearch.match(pattern);
      if (matches && matches.length > 0) {
        try {
          // Try to parse the first match as a date
          const dateStr = matches[0];
          const parsedDate = new Date(dateStr);
          
          // Validate the date is reasonable (not in future, not too old)
          const now = new Date();
          const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
          
          // Check if it's a valid date and within reasonable bounds
          if (!isNaN(parsedDate.getTime()) && parsedDate <= now && parsedDate >= tenYearsAgo) {
            detectedDate = parsedDate;
            console.log(`✅ Detected video date: ${parsedDate.toDateString()}`);
            break;
          }
        } catch (error) {
          // Continue to next pattern if parsing fails
          continue;
        }
      }
    }
    
    if (detectedDate) {
      const daysDiff = Math.floor((new Date() - detectedDate) / (1000 * 60 * 60 * 24));
      console.log(`📊 Video is approximately ${daysDiff} days old`);
      
      // Return suggested starting search strategy based on age
      if (daysDiff <= 30) return { startStrategy: 0, estimatedAge: daysDiff };
      if (daysDiff <= 90) return { startStrategy: 1, estimatedAge: daysDiff };
      if (daysDiff <= 365) return { startStrategy: 2, estimatedAge: daysDiff };
      if (daysDiff <= 1825) return { startStrategy: 3, estimatedAge: daysDiff };
      return { startStrategy: 4, estimatedAge: daysDiff }; // All time
    }
    
    console.log(`⚠️ Could not detect video age, will use progressive search`);
    return { startStrategy: 0, estimatedAge: null };
    
  } catch (error) {
    console.error(`❌ Error detecting video age:`, error.message);
    return { startStrategy: 0, estimatedAge: null };
  }
};

/**
 * Search for fact-checks using Google Fact Check Tools API with progressive timeline strategy
 */
const searchFactChecks = async (claim, videoUrl = '', caption = '') => {
  console.log(`🔍 Searching fact-checks for: ${claim}`);
  
  const baseUrl = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
  
  // Multiple search strategies for better coverage
  const searchQueries = [
    claim, // Original claim
    claim.replace(/["']/g, ''), // Remove quotes
    claim.split(' ').slice(0, 5).join(' '), // First 5 words for broader search
  ];
  
  // Remove duplicates
  const uniqueQueries = [...new Set(searchQueries)];
  
  // Progressive timeline search strategy - start with recent, expand if needed
  const timelineStrategies = [
    { maxAgeDays: 30, description: "last 30 days" },
    { maxAgeDays: 90, description: "last 90 days" },
    { maxAgeDays: 365, description: "last year" },
    { maxAgeDays: 1825, description: "last 5 years" }, // 5 years
    { description: "all time" } // No maxAgeDays = search all time
  ];
  
  // Detect video age to optimize search strategy
  const ageDetection = detectVideoAge(videoUrl, caption);
  let allResults = [];
  let searchStrategy = ageDetection.startStrategy;
  
  console.log(`🎯 Starting search from strategy ${searchStrategy} based on ${ageDetection.estimatedAge ? `estimated age: ${ageDetection.estimatedAge} days` : 'progressive approach'}`);
  
  // Try each timeline strategy until we find results or exhaust all options
  while (searchStrategy < timelineStrategies.length && allResults.length === 0) {
    const strategy = timelineStrategies[searchStrategy];
    console.log(`📅 Searching ${strategy.description}...`);
  
  for (const query of uniqueQueries) {
    try {
      const params = {
        query: query.trim(),
        languageCode: 'en',
        pageSize: 10,
        offset: 0,
        key: process.env.GOOGLE_FACTCHECK_API_KEY
      };
      
        // Only add maxAgeDays if specified (omit for "all time" search)
        if (strategy.maxAgeDays) {
          params.maxAgeDays = strategy.maxAgeDays;
        }
        
        console.log(`🔎 Searching with query: "${query}" (${strategy.description})`);
      const response = await axios.get(baseUrl, { params });
      
      if (response.data.claims && response.data.claims.length > 0) {
        allResults = allResults.concat(response.data.claims);
        console.log(`  ✅ Found ${response.data.claims.length} results`);
      }
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
        console.log(`  ⚠️ Query "${query}" (${strategy.description}) failed:`, error.message);
      continue; // Try next query
    }
    }
    
    // If we found results, break out of the timeline loop
    if (allResults.length > 0) {
      console.log(`✅ Found results using ${strategy.description} search strategy`);
      break;
    }
    
    searchStrategy++;
  }
  
  // If still no results after all timeline strategies, log the issue
  if (allResults.length === 0) {
    console.log(`⚠️ No results found across all timeline strategies (30 days → all time)`);
  }
  
  // Remove duplicate results based on claim text
  const uniqueResults = allResults.filter((claim, index, self) => 
    index === self.findIndex(c => c.text === claim.text)
  );
  
  console.log(`✅ Total unique results found: ${uniqueResults.length}`);
  
  // Sort by most recent review date
  uniqueResults.sort((a, b) => {
    const aDate = a.claimReview?.[0]?.reviewDate || '1970-01-01';
    const bDate = b.claimReview?.[0]?.reviewDate || '1970-01-01';
    return new Date(bDate) - new Date(aDate);
  });
  
  return { 
    claims: uniqueResults,
    searchStrategy: searchStrategy < timelineStrategies.length ? timelineStrategies[searchStrategy] : { description: "all strategies exhausted" },
    totalStrategiesTried: searchStrategy + 1,
    estimatedVideoAge: ageDetection.estimatedAge
  };
};

/**
 * Scrape article content from URL using lightweight approach
 */
const scrapeArticleContent = async (url, title = '') => {
  console.log(`🔗 Scraping article: ${url}`);
  
  // Check cache first
  if (articleContentCache.has(url)) {
    console.log(`📋 Using cached content for ${url}`);
    return articleContentCache.get(url);
  }
  
  try {
    // Use axios with comprehensive headers to mimic real browser
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });
    
    if (response.data) {
      const content = extractTextFromHTML(response.data, url, title);
      if (content && content.length > 100) {
        articleContentCache.set(url, content);
        console.log(`✅ Article scraped successfully (${content.length} chars)`);
        return content;
      } else {
        console.log(`⚠️ Content too short or empty from ${url}`);
      }
    }
    
    // Fallback: Use title and URL as minimal content
    if (title && title.length > 10) {
      const fallbackContent = `Article from ${extractDomainFromUrl(url)}: "${title}". Full content could not be retrieved, but article title suggests this is a fact-check or news report about the topic.`;
      console.log(`📝 Using enhanced title fallback content`);
      articleContentCache.set(url, fallbackContent);
      return fallbackContent;
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ Error scraping ${url}:`, error.message);
    
    // Even on error, try to use title as fallback
    if (title && title.length > 10) {
      const fallbackContent = `Article from ${extractDomainFromUrl(url)}: "${title}". Content retrieval failed due to: ${error.message}`;
      console.log(`📝 Using error fallback with title`);
      return fallbackContent;
    }
    
    return null;
  }
};

/**
 * Extract domain from URL for fallback content
 */
const extractDomainFromUrl = (url) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'news source';
  }
};

/**
 * Extract clean text from HTML using Cheerio with enhanced content detection
 */
const extractTextFromHTML = (html, url, title = '') => {
  try {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, .advertisement, .ad, .social-share, .comments, .sidebar, .related-articles').remove();
    
    // Enhanced content selectors for various news sites
    const contentSelectors = [
      // General article selectors
      'article',
      '[role="article"]',
      '.article-content',
      '.story-body',
      '.entry-content', 
      '.post-content',
      '.article-body',
      '.content-body',
      
      // Fact-check specific selectors
      '.fact-check-content',
      '.claim-review',
      '.verdict',
      '.rating-section',
      
      // News site specific selectors
      '.story-content',
      '.article-wrap',
      '.post-body',
      '.content',
      'main',
      '.main-content',
      
      // Fallback selectors
      '.page-content',
      '#content',
      '.container'
    ];
    
    let content = '';
    let bestContentLength = 0;
    
    // Try each selector and pick the one with most relevant content
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const elementText = element.text().trim();
        
        // Score content based on length and relevance
        let score = elementText.length;
        
        // Bonus for fact-check related keywords
        if (elementText.toLowerCase().includes('fact') || 
            elementText.toLowerCase().includes('claim') ||
            elementText.toLowerCase().includes('verdict') ||
            elementText.toLowerCase().includes('false') ||
            elementText.toLowerCase().includes('true')) {
          score *= 1.5;
        }
        
        if (score > bestContentLength && elementText.length > 200) {
          content = elementText;
          bestContentLength = score;
        }
      }
    }
    
    // If still no good content, try paragraph-based extraction
    if (!content || content.length < 200) {
      const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
      content = paragraphs.filter(p => p.length > 50).join(' ');
    }
    
    // Final fallback to body
    if (!content || content.length < 200) {
      content = $('body').text().trim();
    }
    
    // Clean up whitespace and normalize
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
    
    // If content is still poor quality but we have a title, enhance it
    if (content.length < 300 && title) {
      const domain = extractDomainFromUrl(url);
      content = `${title} - This appears to be a fact-check or news article from ${domain}. ` + content;
    }
    
    return content;
    
  } catch (error) {
    console.error(`❌ Error parsing HTML from ${url}:`, error.message);
    
    // Return title-based content even on parse error
    if (title) {
      return `Article: "${title}" from ${extractDomainFromUrl(url)}. HTML parsing failed but title suggests fact-check content.`;
    }
    
    return '';
  }
};

/**
 * Analyze full article content using AI to make independent inference
 */
const analyzeArticleContent = async (articleContent, originalClaim, articleTitle, publisherName, articleUrl) => {
  console.log(`🔍 AI analyzing article content for independent inference...`);
  
  try {
    const prompt = `You are an expert fact-checker conducting an independent analysis of a news article to verify a specific claim. Your task is to read the full article content and provide your own professional assessment.

CLAIM TO VERIFY: "${originalClaim}"

ARTICLE DETAILS:
- Publisher: ${publisherName}
- Title: ${articleTitle}
- URL: ${articleUrl}

FULL ARTICLE CONTENT:
${articleContent}

ANALYSIS INSTRUCTIONS:
1. Read through the entire article carefully
2. Look for direct evidence related to the claim
3. Consider the credibility of sources cited in the article
4. Evaluate the quality and completeness of evidence presented
5. Make your own independent determination based on the evidence

ASSESSMENT CRITERIA:
✅ VERIFIED/TRUE if:
- Multiple credible sources confirm the claim
- Direct evidence (photos, documents, official statements)
- Consistent reporting across reliable outlets
- Primary sources quoted

❌ FALSE/DEBUNKED if:
- Clear evidence contradicting the claim  
- Official denials from credible sources
- Factual errors or misrepresentations identified
- Evidence shows claim is fabricated or manipulated

⚖️ MIXED/PARTIALLY TRUE if:
- Some elements are accurate but others are not
- Claim lacks important context
- Evidence is incomplete or conflicting

❓ INSUFFICIENT EVIDENCE if:
- Not enough reliable information to make determination
- Sources are unclear or unverifiable
- Article doesn't directly address the claim

OUTPUT FORMAT:
{
  "verdict": "TRUE|FALSE|MIXED|INSUFFICIENT",
  "confidence": "HIGH|MEDIUM|LOW", 
  "evidence_summary": "2-3 sentence summary of key evidence found",
  "reasoning": "Your detailed reasoning for this verdict",
  "key_facts": ["fact1", "fact2", "fact3"],
  "credibility_assessment": "Assessment of article and source credibility"
}

Provide ONLY the JSON response with your independent analysis:`;
    
    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      prompt
    );
    
    const analysisText = result.response.text().trim();
    
    try {
      // Try to parse as JSON
      const analysis = JSON.parse(analysisText);
      console.log(`✅ AI analysis completed: ${analysis.verdict} (${analysis.confidence})`);
      return analysis;
    } catch (jsonError) {
      // Fallback parsing if JSON is malformed
      console.log(`⚠️ JSON parse failed, extracting key info manually`);
      
      const verdict = extractFromText(analysisText, ['TRUE', 'FALSE', 'MIXED', 'INSUFFICIENT']) || 'INSUFFICIENT';
      const confidence = extractFromText(analysisText, ['HIGH', 'MEDIUM', 'LOW']) || 'LOW';
      
      return {
        verdict: verdict,
        confidence: confidence,
        evidence_summary: analysisText.substring(0, 200) + '...',
        reasoning: analysisText,
        key_facts: [],
        credibility_assessment: `Analysis of ${publisherName} article`
      };
    }
    
  } catch (error) {
    console.error('❌ Error in AI article analysis:', error);
    return {
      verdict: 'INSUFFICIENT',
      confidence: 'LOW',
      evidence_summary: 'Unable to analyze article content due to technical error',
      reasoning: `Error occurred while analyzing article: ${error.message}`,
      key_facts: [],
      credibility_assessment: 'Analysis failed'
    };
  }
};

/**
 * Extract key terms from text (helper function)
 */
const extractFromText = (text, possibleValues) => {
  const upperText = text.toUpperCase();
  for (const value of possibleValues) {
    if (upperText.includes(value.toUpperCase())) {
      return value;
    }
  }
  return null;
};

/**
 * Enhanced fact-check analysis with logical consistency, Reddit integration, and weighted scoring
 */
const analyzeFactChecks = async (factCheckResults, originalClaim, videoAnalysis = null, logicalConsistency = null) => {
  console.log(`📊 Analyzing fact-check results with latest article prioritization...`);
  
  // If no Google fact-check results, try Reddit as fallback
  let redditAnalysis = null;
  if (!factCheckResults.claims || factCheckResults.claims.length === 0) {
    console.log('🔄 No Google fact-check results found, searching Reddit...');
    
    try {
      const redditResults = await searchRedditForVerification(originalClaim);
      if (redditResults.total_posts > 0) {
        redditAnalysis = await analyzeRedditSentiment(redditResults, originalClaim);
        
        // Generate verdict based on Reddit analysis
        let redditVerdict = 'Unknown';
        let redditConfidence = 'Low';
        
        if (redditAnalysis.sentiment === 'DEBUNKS' && redditAnalysis.confidence > 0.6) {
          redditVerdict = 'False';
          redditConfidence = 'Medium';
        } else if (redditAnalysis.sentiment === 'STRONGLY_SUPPORTS' && redditAnalysis.confidence > 0.6) {
          redditVerdict = 'True';
          redditConfidence = 'Medium';
        } else if (redditAnalysis.sentiment === 'SKEPTICAL') {
          redditVerdict = 'Questionable';
          redditConfidence = 'Low';
        }
        
        return {
          verdict: redditVerdict,
          confidence: redditConfidence,
          summary: generateRedditBasedSummary(redditVerdict, redditAnalysis, redditResults.total_posts),
          sources: [],
          latestArticleAnalysis: null,
          redditAnalysis: redditAnalysis,
          redditResults: redditResults,
          videoAnalysis: videoAnalysis,
          logicalConsistency: logicalConsistency,
          source: 'reddit_fallback'
        };
      }
    } catch (error) {
      console.error('❌ Reddit fallback failed:', error);
    }
    
    return {
      verdict: 'Unknown',
      confidence: 'Low',
      summary: 'No fact-check information available for this claim from Google or Reddit.',
      sources: [],
      latestArticleAnalysis: null,
      redditAnalysis: null,
      videoAnalysis: videoAnalysis,
      logicalConsistency: logicalConsistency
    };
  }
  
  const claims = factCheckResults.claims;
  const allSources = [];
  
  // Extract all sources with review dates
  claims.forEach(claim => {
    if (claim.claimReview && claim.claimReview.length > 0) {
      claim.claimReview.forEach(review => {
        if (review.textualRating && review.url) {
          allSources.push({
            publisher: review.publisher?.name || 'Unknown',
            url: review.url,
            title: review.title || '',
            rating: review.textualRating,
            reviewDate: review.reviewDate || '1970-01-01',
            publisherSite: review.publisher?.site || ''
          });
        }
      });
    }
  });
  
  // Sort by date - LATEST FIRST (this is the key change!)
  allSources.sort((a, b) => {
    return new Date(b.reviewDate) - new Date(a.reviewDate);
  });
  
  console.log(`📅 Found ${allSources.length} sources, prioritizing latest articles:`);
  allSources.slice(0, 3).forEach((source, index) => {
    console.log(`  ${index + 1}. ${source.publisher} (${source.reviewDate}) - ${source.rating}`);
  });
  
  // Get the LATEST article for detailed analysis
  const latestSource = allSources[0];
  let latestArticleAnalysis = null;
  let aiInference = null;
  
  if (latestSource) {
    console.log(`🔍 Analyzing LATEST article: ${latestSource.publisher} (${latestSource.reviewDate})`);
    
    try {
      // Scrape the latest article content
      const articleContent = await scrapeArticleContent(
        latestSource.url, 
        latestSource.title
      );
      
      if (articleContent) {
        // Get AI's independent analysis of the article
        aiInference = await analyzeArticleContent(
          articleContent,
          originalClaim,
          latestSource.title,
          latestSource.publisher,
          latestSource.url
        );
        
        latestArticleAnalysis = {
          source: latestSource,
          fullContent: articleContent.substring(0, 1000) + '...', // Truncate for storage
          aiAnalysis: aiInference
        };
      }
    } catch (error) {
      console.error(`❌ Error analyzing latest article:`, error.message);
    }
  }
  
  // Publisher credibility weights
  const publisherWeights = {
    'reuters': 1.0,
    'ap news': 1.0,
    'associated press': 1.0,
    'bbc': 0.9,
    'snopes': 0.9,
    'politifact': 0.9,
    'factcheck.org': 0.9,
    'washington post': 0.8,
    'new york times': 0.8,
    'cnn': 0.7,
    'fox news': 0.7
  };
  
  // Calculate weighted verdict with HEAVY bias toward latest articles
  let falseScore = 0, trueScore = 0, mixedScore = 0, totalWeight = 0;
  const analysisData = [];
  
  allSources.forEach((source, index) => {
    const publisherName = (source.publisher || 'Unknown').toLowerCase();
    let baseWeight = publisherWeights[publisherName] || 0.5;
    
    // LATEST ARTICLE WEIGHTING - exponentially higher weight for recent articles
    let recencyMultiplier = 1.0;
    if (index === 0) recencyMultiplier = 3.0;      // Latest article gets 3x weight
    else if (index === 1) recencyMultiplier = 2.0; // Second latest gets 2x weight
    else if (index === 2) recencyMultiplier = 1.5; // Third latest gets 1.5x weight
    
    const effectiveWeight = baseWeight * recencyMultiplier;
    
    // If we have AI analysis for the latest article, use that verdict
    let normalizedRating = 'unknown';
    let confidence = 0.5;
    
    if (index === 0 && aiInference) {
      // Use AI's independent analysis for the latest article
      switch (aiInference.verdict) {
        case 'TRUE':
          normalizedRating = 'true';
          confidence = aiInference.confidence === 'HIGH' ? 0.95 : aiInference.confidence === 'MEDIUM' ? 0.8 : 0.6;
          break;
        case 'FALSE':
          normalizedRating = 'false';
          confidence = aiInference.confidence === 'HIGH' ? 0.95 : aiInference.confidence === 'MEDIUM' ? 0.8 : 0.6;
          break;
        case 'MIXED':
          normalizedRating = 'mixed';
          confidence = 0.75;
          break;
      }
      console.log(`🤖 Using AI inference for latest article: ${normalizedRating} (${confidence})`);
    } else {
      // Use traditional rating analysis for other sources
      const rating = source.rating.toLowerCase();
      if (rating.includes('false') || rating.includes('incorrect') || rating.includes('misleading') || 
          rating.includes('pants on fire') || rating.includes('fake') || rating.includes('fabricated')) {
        normalizedRating = 'false';
        confidence = 0.9;
      } else if (rating.includes('true') || rating.includes('correct') || rating.includes('accurate') || 
                 rating.includes('verified') || rating.includes('confirmed')) {
        normalizedRating = 'true';
        confidence = 0.9;
      } else if (rating.includes('partially') || rating.includes('mixed') || rating.includes('half') || 
                 rating.includes('mostly') || rating.includes('some')) {
        normalizedRating = 'mixed';
        confidence = 0.7;
      }
    }
    
    // Apply logical consistency adjustment
    let logicalAdjustment = 0;
    if (logicalConsistency && index === 0) { // Only apply to latest source
      logicalAdjustment = logicalConsistency.weight_adjustment || 0;
      console.log(`🧠 Applying logical consistency adjustment: ${logicalAdjustment}`);
    }
    
    const finalWeight = (effectiveWeight * confidence) + logicalAdjustment;
    totalWeight += Math.max(0, finalWeight); // Ensure weight doesn't go negative
    
    if (normalizedRating === 'false') {
      falseScore += Math.max(0, finalWeight);
    } else if (normalizedRating === 'true') {
      trueScore += Math.max(0, finalWeight);
    } else if (normalizedRating === 'mixed') {
      mixedScore += Math.max(0, finalWeight);
    }
    
    analysisData.push({
      source: source,
      normalizedRating,
      confidence,
      baseWeight,
      recencyMultiplier,
      finalWeight,
      isLatest: index === 0
    });
  });
  
  // Determine final verdict based on weighted scores
  let primaryVerdict = 'Unknown';
  let overallConfidence = 'Low';
  
  if (totalWeight > 0) {
    const falseRatio = falseScore / totalWeight;
    const trueRatio = trueScore / totalWeight;
    const mixedRatio = mixedScore / totalWeight;
    
    console.log(`📊 Score ratios: False=${(falseRatio * 100).toFixed(1)}%, True=${(trueRatio * 100).toFixed(1)}%, Mixed=${(mixedRatio * 100).toFixed(1)}%`);
    
    if (falseRatio >= 0.5) {
      primaryVerdict = 'False';
      overallConfidence = falseRatio >= 0.7 ? 'High' : 'Medium';
    } else if (trueRatio >= 0.5) {
      primaryVerdict = 'True';
      overallConfidence = trueRatio >= 0.7 ? 'High' : 'Medium';
    } else if (mixedRatio >= 0.4) {
      primaryVerdict = 'Mixed';
      overallConfidence = 'Medium';
    }
    
    // Boost confidence if latest article analysis is strong
    if (aiInference && aiInference.confidence === 'HIGH' && overallConfidence !== 'High') {
      overallConfidence = 'Medium';
    }
  }
  
  const summary = generateLatestFocusedSummary(primaryVerdict, overallConfidence, allSources.length, latestArticleAnalysis, aiInference, factCheckResults);
  
  return {
    verdict: primaryVerdict,
    confidence: overallConfidence,
    summary,
    sources: allSources.slice(0, 4), // Top 4 sources (latest first)
    latestArticleAnalysis,
    videoAnalysis: videoAnalysis,
    logicalConsistency: logicalConsistency,
    redditAnalysis: redditAnalysis,
    analysisDetails: {
      totalSources: allSources.length,
      latestSourcePriority: true,
      falseRatio: totalWeight > 0 ? (falseScore / totalWeight).toFixed(2) : '0',
      trueRatio: totalWeight > 0 ? (trueScore / totalWeight).toFixed(2) : '0',
      mixedRatio: totalWeight > 0 ? (mixedScore / totalWeight).toFixed(2) : '0',
      aiInferenceUsed: !!aiInference,
      logicalConsistencyUsed: !!logicalConsistency,
      videoAnalysisUsed: !!videoAnalysis,
      searchStrategy: factCheckResults.searchStrategy?.description || 'unknown',
      totalStrategiesTried: factCheckResults.totalStrategiesTried || 1,
      estimatedVideoAge: factCheckResults.estimatedVideoAge
    }
  };
};

/**
 * Generate Reddit-based summary when no Google fact-checks are available
 */
const generateRedditBasedSummary = (verdict, redditAnalysis, totalPosts) => {
  let summary = `📊 **REDDIT COMMUNITY ANALYSIS** (${totalPosts} relevant discussions found)\n\n`;
  
  summary += `🔍 **Community Sentiment**: ${redditAnalysis.sentiment.replace('_', ' ')}\n`;
  summary += `📈 **Confidence Level**: ${(redditAnalysis.confidence * 100).toFixed(0)}%\n\n`;
  
  if (redditAnalysis.community_consensus && redditAnalysis.community_consensus !== 'No data available') {
    summary += `💬 **Community Consensus**: ${redditAnalysis.community_consensus}\n\n`;
  }
  
  if (redditAnalysis.verification_signals && redditAnalysis.verification_signals.length > 0) {
    summary += `✅ **Verification Signals Found**:\n`;
    redditAnalysis.verification_signals.slice(0, 3).forEach((signal, index) => {
      summary += `  ${index + 1}. ${signal}\n`;
    });
    summary += `\n`;
  }
  
  if (redditAnalysis.credible_sources_mentioned && redditAnalysis.credible_sources_mentioned.length > 0) {
    summary += `📰 **Credible Sources Mentioned**: ${redditAnalysis.credible_sources_mentioned.join(', ')}\n\n`;
  }
  
  if (redditAnalysis.misinformation_flags && redditAnalysis.misinformation_flags.length > 0) {
    summary += `⚠️ **Misinformation Flags**: ${redditAnalysis.misinformation_flags.join(', ')}\n\n`;
  }
  
  // Overall verdict
  summary += `⭐ **REDDIT-BASED VERDICT**: `;
  switch (verdict) {
    case 'True':
      summary += `**COMMUNITY SUPPORTS** - Reddit discussions generally support this claim`;
      break;
    case 'False':
      summary += `**COMMUNITY DEBUNKS** - Reddit discussions actively contradict this claim`;
      break;
    case 'Questionable':
      summary += `**COMMUNITY SKEPTICAL** - Reddit discussions express doubt about this claim`;
      break;
    default:
      summary += `**INCONCLUSIVE** - Reddit discussions show mixed or unclear sentiment`;
  }
  
  summary += `\n\n⚠️ **Note**: This analysis is based on Reddit community discussions and should be considered alongside professional fact-checking sources when available.`;
  
  return summary;
};

/**
 * Generate latest-focused summary based on analysis
 */
const generateLatestFocusedSummary = (verdict, confidence, sourceCount, latestArticleAnalysis, aiInference, factCheckResults = null) => {
  let summary = `📊 **LATEST ARTICLE ANALYSIS** (prioritizing most recent reporting)\n\n`;
  
  if (latestArticleAnalysis) {
    const latestSource = latestArticleAnalysis.source;
    summary += `🔍 **Primary Analysis**: Latest article from **${latestSource.publisher}** (${latestSource.reviewDate})\n`;
    
    if (aiInference) {
      summary += `🤖 **AI Independent Inference**: ${aiInference.verdict} (${aiInference.confidence} confidence)\n`;
      summary += `📋 **Evidence Found**: ${aiInference.evidence_summary}\n\n`;
      
      if (aiInference.key_facts && aiInference.key_facts.length > 0) {
        summary += `🎯 **Key Facts from Article**:\n`;
        aiInference.key_facts.slice(0, 3).forEach((fact, index) => {
          summary += `  ${index + 1}. ${fact}\n`;
        });
        summary += `\n`;
      }
    }
  }
  
  // Overall verdict
  summary += `⭐ **FINAL VERDICT**: `;
  switch (verdict) {
    case 'True':
      summary += `**CONFIRMED TRUE** - Latest reporting supports this claim`;
      break;
    case 'False':
      summary += `**DEBUNKED FALSE** - Latest reporting contradicts this claim`;
      break;
    case 'Mixed':
      summary += `**MIXED ACCURACY** - Latest reporting shows partial truth with important caveats`;
      break;
    default:
      summary += `**INCONCLUSIVE** - Latest reporting insufficient to determine accuracy`;
  }
  
  summary += `\n📈 **Confidence Level**: ${confidence}`;
  
  if (latestArticleAnalysis && aiInference) {
    summary += ` (Based on independent AI analysis of latest article content)`;
  }
  
  summary += `\n\n📚 **Total Sources Reviewed**: ${sourceCount} (sorted by recency, latest weighted 3x higher)`;
  
  // Add timeline search information if available
  if (factCheckResults && factCheckResults.searchStrategy) {
    summary += `\n🔍 **Search Strategy**: Found results using ${factCheckResults.searchStrategy.description} search`;
    if (factCheckResults.totalStrategiesTried > 1) {
      summary += ` (tried ${factCheckResults.totalStrategiesTried} timeline strategies)`;
    }
    if (factCheckResults.estimatedVideoAge) {
      summary += `\n📅 **Estimated Content Age**: ~${factCheckResults.estimatedVideoAge} days old`;
    }
  }
  
  return summary;
};

/**
 * Generate advanced summary based on analysis (legacy compatibility)
 */
const generateAdvancedSummary = (verdict, confidence, sourceCount, allRatings) => {
  let summary = `Based on analysis of ${sourceCount} fact-check source${sourceCount !== 1 ? 's' : ''}, `;
  
  // Get credible sources count
  const credibleSources = allRatings.filter(r => r.weight >= 0.8).length;
  
  switch (verdict) {
    case 'True':
      summary += `this claim appears to be **accurate**`;
      if (credibleSources > 0) {
        summary += ` (${credibleSources} highly credible source${credibleSources !== 1 ? 's' : ''} confirm this)`;
      }
      summary += '.';
      break;
    case 'False':
      summary += `this claim appears to be **false or misleading**`;
      if (credibleSources > 0) {
        summary += ` (${credibleSources} highly credible source${credibleSources !== 1 ? 's' : ''} debunk this)`;
      }
      summary += '.';
      break;
    case 'Mixed':
      summary += `this claim has **mixed accuracy** - some elements may be true while others are false or lack context.`;
      break;
    default:
      summary += `the accuracy of this claim could not be definitively determined. `;
      if (sourceCount === 0) {
        summary += `No established fact-checkers have reviewed this specific claim yet.`;
      } else {
        summary += `Available sources provide inconclusive or conflicting information.`;
      }
  }
  
  // Add confidence indicator
  if (confidence === 'High') {
    summary += ` **Confidence: High** - Multiple credible sources agree.`;
  } else if (confidence === 'Medium') {
    summary += ` **Confidence: Medium** - Some credible sources available.`;
  } else {
    summary += ` **Confidence: Low** - Limited or no verification available.`;
  }
  
  return summary;
};

/**
 * Generate summary based on analysis (legacy function for backwards compatibility)
 */
const generateSummary = (verdict, sourceCount, latestClaim) => {
  let summary = `Based on ${sourceCount} fact-check source${sourceCount !== 1 ? 's' : ''}, `;
  
  switch (verdict) {
    case 'True':
      summary += 'this claim appears to be accurate.';
      break;
    case 'False':
      summary += 'this claim appears to be false or misleading.';
      break;
    case 'Mixed':
      summary += 'this claim has mixed accuracy - some parts may be true while others are false.';
      break;
    default:
      summary += 'the accuracy of this claim could not be determined.';
  }
  
  if (latestClaim && latestClaim.claimReview && latestClaim.claimReview[0]) {
    const review = latestClaim.claimReview[0];
    summary += ` Latest review by ${review.publisher?.name || 'fact-checkers'} rated it as "${review.textualRating}".`;
  }
  
  return summary;
};

/**
 * Store fact-check result in memory
 */
const storeFactCheckResult = (userId, claim, result) => {
  const key = `${userId}_${Date.now()}`;
  const factCheckData = {
    userId,
    claim,
    result,
    timestamp: Date.now(),
    id: key
  };
  
  factCheckMemory.set(key, factCheckData);
  
  // Also store by user ID for easy retrieval
  const userKey = `user_${userId}`;
  let userFactChecks = factCheckMemory.get(userKey) || [];
  userFactChecks.push(factCheckData);
  factCheckMemory.set(userKey, userFactChecks);
  
  console.log(`💾 Stored fact-check result for user ${userId}`);
  return key;
};

/**
 * Get fact-check history for a user
 */
const getUserFactCheckHistory = (userId) => {
  const userKey = `user_${userId}`;
  return factCheckMemory.get(userKey) || [];
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
 * Enhanced main function to process Instagram reel with comprehensive analysis
 */
const processInstagramReel = async (senderId, attachment) => {
  console.log(`🎬 Processing Instagram reel for user: ${senderId}`);
  
  if (attachment.type !== 'ig_reel' || !attachment.payload?.url) {
    throw new Error('Invalid Instagram reel attachment');
  }
  
  const videoUrl = attachment.payload.url;
  const caption = attachment.payload.title || '';
  const fileName = `${uuidv4()}.mp4`;
  
  let videoPath = null;
  let audioPath = null;
  let framePaths = [];
  
  try {
    // Step 1: Download video
    videoPath = await downloadVideo(videoUrl, fileName);
    
    // Step 2: Extract audio and video frames in parallel
    const [audioPath_result, framePaths_result] = await Promise.all([
      extractAudio(videoPath),
      extractVideoFrames(videoPath, 5)
    ]);
    audioPath = audioPath_result;
    framePaths = framePaths_result;
    
    // Step 3: Transcribe audio
    const transcription = await transcribeAudio(audioPath);
    
    // Step 4: Analyze video frames for visual context
    const videoAnalysis = await analyzeVideoFrames(framePaths, transcription);
    
    // Step 5: Extract claim with enhanced context
    const claim = await extractClaim(transcription, caption);
    
    if (claim === 'No verifiable claim found') {
      return {
        success: false,
        message: 'No verifiable claims found in this video to fact-check.',
        videoAnalysis: videoAnalysis // Still provide video analysis
      };
    }
    
    // Step 6: Search for fact-checks with timeline optimization
    const factCheckResults = await searchFactChecks(claim, videoUrl, caption);
    
    // Step 7: Check logical consistency
    const logicalConsistency = await checkLogicalConsistency(claim, videoAnalysis, factCheckResults);
    
    // Step 8: Enhanced analysis with all new features
    const analysis = await analyzeFactChecks(factCheckResults, claim, videoAnalysis, logicalConsistency);
    
    // Step 9: Store comprehensive result
    const resultId = storeFactCheckResult(senderId, claim, {
      transcription,
      caption,
      claim,
      analysis,
      videoAnalysis,
      logicalConsistency,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      claim,
      transcription,
      analysis,
      videoAnalysis,
      logicalConsistency,
      resultId
    };
    
  } catch (error) {
    console.error('❌ Error processing Instagram reel:', error);
    throw error;
  } finally {
    // Cleanup temporary files
    const filesToCleanup = [videoPath, audioPath, ...framePaths].filter(Boolean);
    if (filesToCleanup.length > 0) {
      await cleanupFiles(...filesToCleanup);
    }
  }
};

module.exports = {
  processInstagramReel,
  getUserFactCheckHistory,
  storeFactCheckResult,
  downloadVideo,
  extractAudio,
  extractVideoFrames,
  analyzeVideoFrames,
  transcribeAudio,
  extractClaim,
  checkLogicalConsistency,
  detectVideoAge,
  searchFactChecks,
  searchRedditForVerification,
  analyzeRedditSentiment,
  analyzeFactChecks
};
