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
 * Detect actual event age by analyzing post activity spikes
 */
const detectActualEventAge = (allPosts, now) => {
  console.log(`🔍 Analyzing post timeline to detect actual event occurrence...`);
  
  if (allPosts.length < 5) {
    return { eventAgeDays: null, confidence: 'low', method: 'insufficient_data' };
  }
  
  // Group posts by day to find activity spikes
  const dailyPostCounts = {};
  allPosts.forEach(post => {
    const postDate = new Date(post.created_utc * 1000);
    const dayKey = postDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!dailyPostCounts[dayKey]) {
      dailyPostCounts[dayKey] = { count: 0, posts: [], avgScore: 0 };
    }
    
    dailyPostCounts[dayKey].count++;
    dailyPostCounts[dayKey].posts.push(post);
  });
  
  // Calculate average scores for each day
  Object.keys(dailyPostCounts).forEach(day => {
    const dayData = dailyPostCounts[day];
    const totalScore = dayData.posts.reduce((sum, post) => sum + (post.score || 0), 0);
    dayData.avgScore = totalScore / dayData.count;
  });
  
  // Convert to sorted array
  const dailyActivity = Object.entries(dailyPostCounts)
    .map(([date, data]) => ({
      date: date,
      timestamp: new Date(date).getTime() / 1000,
      count: data.count,
      avgScore: data.avgScore,
      posts: data.posts
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
  
  // Look for the major spike that indicates original event
  let maxSpike = { count: 0, date: null, confidence: 'low' };
  let baselineActivity = 0;
  
  if (dailyActivity.length >= 3) {
    // Calculate baseline (average activity excluding the highest spike)
    const sortedByCounts = [...dailyActivity].sort((a, b) => b.count - a.count);
    baselineActivity = sortedByCounts.slice(1).reduce((sum, day) => sum + day.count, 0) / (sortedByCounts.length - 1);
    
    // Find the most significant spike
    dailyActivity.forEach(day => {
      // Spike significance = raw count + high scores + timeline position
      let spikeScore = day.count;
      
      // Bonus for high-scoring posts (breaking news gets more upvotes)
      if (day.avgScore > 100) spikeScore *= 1.5;
      if (day.avgScore > 500) spikeScore *= 2.0;
      
      // Bonus for being earlier in timeline (original reporting)
      const dayIndex = dailyActivity.indexOf(day);
      const timelineBonus = (dailyActivity.length - dayIndex) / dailyActivity.length;
      spikeScore *= (1 + timelineBonus * 0.5);
      
      if (spikeScore > maxSpike.count) {
        maxSpike = {
          count: spikeScore,
          date: day.date,
          originalCount: day.count,
          avgScore: day.avgScore,
          confidence: day.count > (baselineActivity * 2) ? 'high' : day.count > baselineActivity ? 'medium' : 'low'
        };
      }
    });
  }
  
  if (maxSpike.date) {
    const eventTimestamp = new Date(maxSpike.date).getTime() / 1000;
    const eventAgeDays = Math.floor((now - eventTimestamp) / 86400);
    
    console.log(`📊 Event spike detected: ${maxSpike.date} (${eventAgeDays} days ago)`);
    console.log(`   📈 Spike activity: ${maxSpike.originalCount} posts (avg score: ${Math.round(maxSpike.avgScore)})`);
    console.log(`   📊 Baseline activity: ${Math.round(baselineActivity)} posts/day`);
    console.log(`   🎯 Confidence: ${maxSpike.confidence} (${maxSpike.originalCount}x above baseline: ${(maxSpike.originalCount / Math.max(baselineActivity, 1)).toFixed(1)}x)`);
    
    return {
      eventAgeDays: eventAgeDays,
      confidence: maxSpike.confidence,
      method: 'spike_detection',
      spikeDate: maxSpike.date,
      spikeActivity: maxSpike.originalCount,
      baselineActivity: Math.round(baselineActivity),
      dailyBreakdown: dailyActivity.map(d => ({ date: d.date, count: d.count, avgScore: Math.round(d.avgScore) }))
    };
  }
  
  console.log(`⚠️ No clear event spike detected, using earliest post method`);
  return { eventAgeDays: null, confidence: 'low', method: 'no_clear_spike' };
};

/**
 * Use Google Custom Search API to determine claim age from actual news articles
 */
const searchGoogleForClaimAge = async (claim, videoUrl = '', caption = '', transcription = '') => {
  console.log(`🔍 Using Google Custom Search to find news articles about: ${claim.substring(0, 50)}...`);
  
  // Check cache first
  const cacheKey = `google_age_${claim.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  if (redditSearchCache.has(cacheKey)) {
    console.log('📋 Using cached Google age results');
    return redditSearchCache.get(cacheKey);
  }
  
  try {
    // Create comprehensive search queries from all available context
    const searchQueries = await createSmartSearchQueries(claim, caption, transcription);
    console.log(`🎯 Created ${searchQueries.length} targeted search queries`);
    
    let allArticles = [];
    
    // Search with multiple queries to get comprehensive results
    for (const query of searchQueries.slice(0, 3)) { // Limit to top 3 queries
      try {
        console.log(`🔍 Searching Google for: "${query.query}"`);
        
        const searchUrl = 'https://www.googleapis.com/customsearch/v1';
        const params = {
          key: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
          cx: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
          q: query.query,
          num: 10,
          dateRestrict: 'm6', // Last 6 months to catch recent events
          sort: 'date', // Sort by date to get chronological results
          tbm: 'nws' // News search specifically
        };
        
        const response = await axios.get(searchUrl, { params, timeout: 10000 });
        
        if (response.data?.items) {
          const articles = [];
          
          // Process each article and scrape content for date analysis
          for (const item of response.data.items.slice(0, 5)) { // Limit to 5 articles per query for performance
            if (!item.snippet || !item.link) continue;
            
            try {
              console.log(`    🔍 Analyzing: ${item.title?.substring(0, 40)}...`);
              
              // Scrape article content
              const articleContent = await scrapeArticleContent(item.link);
              
              if (articleContent && articleContent.length > 100) {
                // STEP 1: First get claim verification from content
                const claimAnalysis = await analyzeArticleContentForClaim(
                  claim,
                  articleContent,
                  item.title,
                  item.snippet
                );
                
                // STEP 2: Only if claim analysis is successful, extract event dates
                const dateAnalysis = await extractEventDatesFromContent(
                  claim, 
                  articleContent, 
                  item.title, 
                  item.snippet
                );
                
                console.log(`      🎯 Claim analysis: ${claimAnalysis.verdict} (${claimAnalysis.confidence})`);
                
                if (dateAnalysis.eventDate) {
                  const ageInDays = Math.floor((Date.now() - dateAnalysis.eventDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  articles.push({
                    title: item.title,
                    snippet: item.snippet,
                    link: item.link,
                    source: extractDomainFromUrl(item.link),
                    content: articleContent.substring(0, 1000), // First 1000 chars for analysis
                    // Claim analysis results
                    claimVerdict: claimAnalysis.verdict,
                    claimConfidence: claimAnalysis.confidence,
                    claimReasoning: claimAnalysis.reasoning,
                    keyEvidence: claimAnalysis.keyEvidence,
                    // Date analysis results
                    eventDate: dateAnalysis.eventDate,
                    eventDateConfidence: dateAnalysis.confidence,
                    eventContext: dateAnalysis.context,
                    ageInDays: ageInDays,
                    queryType: query.type
                  });
                  
                  console.log(`      ✅ Event date found: ${dateAnalysis.eventDate.toLocaleDateString()} (${ageInDays} days ago)`);
                } else {
                  // Still add article even without date if we have claim analysis
                  if (claimAnalysis.verdict !== 'UNCLEAR') {
                    articles.push({
                      title: item.title,
                      snippet: item.snippet,
                      link: item.link,
                      source: extractDomainFromUrl(item.link),
                      content: articleContent.substring(0, 1000),
                      // Claim analysis results
                      claimVerdict: claimAnalysis.verdict,
                      claimConfidence: claimAnalysis.confidence,
                      claimReasoning: claimAnalysis.reasoning,
                      keyEvidence: claimAnalysis.keyEvidence,
                      // No date information
                      eventDate: null,
                      eventDateConfidence: 'low',
                      eventContext: 'No event date found in content',
                      ageInDays: null,
                      queryType: query.type
                    });
                    console.log(`      📝 Added article with claim analysis but no date`);
                  } else {
                    console.log(`      ⚠️ No clear event date or claim verdict found in content`);
                  }
                }
              } else {
                console.log(`      ❌ Could not scrape content or content too short`);
              }
              
              // Rate limiting between article scrapes
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              console.log(`      ❌ Error processing article: ${error.message}`);
              continue;
            }
          }
          
          console.log(`  ✅ Found ${articles.length} dated articles`);
          if (articles.length > 0) {
            const oldestArticle = Math.max(...articles.map(a => a.ageInDays));
            const newestArticle = Math.min(...articles.map(a => a.ageInDays));
            console.log(`  📅 Article age range: ${newestArticle}-${oldestArticle} days old`);
            
            // Show sample articles for debugging
            articles.slice(0, 3).forEach((article, i) => {
              console.log(`  ${i + 1}. ${article.source}: "${article.title.substring(0, 50)}..." (${article.ageInDays} days ago)`);
            });
          }
          
          allArticles = allArticles.concat(articles);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`  ⚠️ Google search error for "${query.query}": ${error.message}`);
        continue;
      }
    }
    
    // Analyze article publication dates to determine event age
    const eventAge = analyzeArticleTimeline(allArticles);
    
    const result = {
      estimatedAgeDays: eventAge.ageDays,
      confidence: eventAge.confidence,
      method: 'google_news_content_analysis',
      earliestArticleDate: eventAge.earliestDate,
      latestArticleDate: eventAge.latestDate,
      totalArticles: allArticles.length,
      searchQueries: searchQueries.map(q => q.query),
      articlesWithContent: allArticles, // Store full articles with content for fact-check analysis
      sampleArticles: allArticles.slice(0, 5).map(a => ({
        title: a.title.substring(0, 60) + '...',
        source: a.source,
        ageInDays: a.ageInDays,
        eventDate: a.eventDate ? a.eventDate.toLocaleDateString() : null,
        eventDateConfidence: a.eventDateConfidence,
        eventContext: a.eventContext
      })),
      timeline: eventAge.timeline,
      articlesAnalyzed: eventAge.articlesAnalyzed
    };
    
    // Cache results for 4 hours
    redditSearchCache.set(cacheKey, result);
    setTimeout(() => redditSearchCache.delete(cacheKey), 14400000);
    
    if (eventAge.ageDays !== null) {
      console.log(`📊 Google age analysis: ${eventAge.ageDays} days old (${eventAge.confidence} confidence)`);
      console.log(`📅 Based on ${allArticles.length} news articles from ${eventAge.sourceCount} sources`);
    } else {
      console.log(`⚠️ Could not determine age from ${allArticles.length} articles found`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in Google age analysis:', error);
    return {
      estimatedAgeDays: null,
      confidence: 'low',
      method: 'google_search_failed',
      error: error.message,
      totalArticles: 0,
      searchQueries: []
    };
  }
};

/**
 * Create smart search queries from video context
 */
const createSmartSearchQueries = async (claim, caption = '', transcription = '') => {
  console.log(`🧠 Creating smart search queries from video context...`);
  
  try {
    const contextPrompt = `You are an expert at creating Google search queries to find news articles about specific events. Create 3 targeted search queries to find when this event actually occurred.

CLAIM: "${claim}"
CAPTION: "${caption || 'Not provided'}"
TRANSCRIPTION: "${transcription ? transcription.substring(0, 200) + '...' : 'Not provided'}"

TASK: Create search queries that will find actual news articles about when this event happened.

REQUIREMENTS:
1. Use specific names, locations, dates mentioned
2. Include news-related terms like "breaking", "reported", "news"  
3. Vary the approach (formal news terms, casual terms, alternate phrasings)
4. Focus on findable, factual elements
5. Each query should be 5-15 words

OUTPUT FORMAT:
[
  {"query": "exact search query here", "type": "primary"},
  {"query": "alternate phrasing here", "type": "secondary"}, 
  {"query": "broader context search", "type": "context"}
]

Create targeted queries that news outlets would have used when reporting this event:`;

    const { result } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      contextPrompt
    );
    
    const response = result.response.text().trim();
    
    try {
      const queries = JSON.parse(response);
      if (Array.isArray(queries) && queries.length > 0) {
        console.log(`✅ Created ${queries.length} AI-generated search queries`);
        return queries;
      }
    } catch (parseError) {
      console.log(`⚠️ AI query generation failed, using fallback queries`);
    }
    
  } catch (error) {
    console.log(`⚠️ AI query generation error: ${error.message}`);
  }
  
  // Fallback: Create basic queries from claim
  const fallbackQueries = [
    { query: claim, type: 'primary' },
    { query: `${claim} news report`, type: 'secondary' },
    { query: `breaking news ${claim}`, type: 'context' }
  ];
  
  console.log(`📝 Using ${fallbackQueries.length} fallback search queries`);
  return fallbackQueries;
};

/**
 * Analyze article content to determine claim verdict (STEP 1: Truth before dates)
 */
const analyzeArticleContentForClaim = async (claim, articleContent, title, snippet) => {
  try {
    const claimAnalysisPrompt = `You are an expert fact-checker analyzing a news article to verify a specific claim. Read the article content carefully and determine if the claim is supported, contradicted, or unclear based on the evidence presented.

CLAIM: "${claim}"
ARTICLE TITLE: "${title}"
ARTICLE CONTENT: "${articleContent}"

TASK: Determine if this article supports, contradicts, or provides unclear evidence for the claim.

INSTRUCTIONS:
1. Focus only on factual evidence in the article
2. Ignore opinions, speculation, or unrelated information
3. Look for direct statements, quotes, and verified facts
4. Consider the source credibility and evidence quality
5. Be conservative - if unclear, mark as "UNCLEAR"

OUTPUT FORMAT (JSON):
{
  "verdict": "TRUE|FALSE|UNCLEAR",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation of why you reached this verdict",
  "keyEvidence": ["list", "of", "key", "supporting", "facts", "from", "article"]
}

REQUIREMENTS:
- Only use "TRUE" if article clearly supports the claim
- Only use "FALSE" if article clearly contradicts the claim
- Use "UNCLEAR" if evidence is insufficient or conflicting
- Use "high" confidence only with strong direct evidence
- Provide clear reasoning and key evidence

Analyze the article and determine the claim verdict:`;

    const { result } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      claimAnalysisPrompt
    );
    
    const response = result.response.text().trim();
    
    try {
      // Clean up markdown-wrapped JSON responses
      let cleanResponse = response;
      if (response.includes('```json')) {
        cleanResponse = response.replace(/```json\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
      } else if (response.includes('```')) {
        cleanResponse = response.replace(/```\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
      }
      
      const analysis = JSON.parse(cleanResponse);
      
      return {
        verdict: analysis.verdict || 'UNCLEAR',
        confidence: analysis.confidence || 'low',
        reasoning: analysis.reasoning || 'Unable to determine verdict from content',
        keyEvidence: analysis.keyEvidence || []
      };
      
    } catch (parseError) {
      console.log(`      ⚠️ Claim analysis JSON parse error: ${parseError.message}`);
    }
    
  } catch (error) {
    console.log(`      ❌ Claim analysis AI error: ${error.message}`);
  }
  
  return {
    verdict: 'UNCLEAR',
    confidence: 'low',
    reasoning: 'Could not analyze claim from article content',
    keyEvidence: []
  };
};

/**
 * Extract event dates from article content using AI analysis (STEP 2: After claim verification)
 */
const extractEventDatesFromContent = async (claim, articleContent, title, snippet) => {
  try {
    const dateExtractionPrompt = `You are an expert at analyzing news articles to find when specific events occurred. Analyze this article content to determine when the claimed event actually happened.

CLAIM: "${claim}"
ARTICLE TITLE: "${title}"
ARTICLE CONTENT: "${articleContent}"

TASK: Find the exact date when this event occurred based on the article content.

INSTRUCTIONS:
1. Look for specific dates, times, and temporal references
2. Identify when the actual event happened (not when it was reported)
3. Consider phrases like "on [date]", "yesterday", "last week", "this morning", etc.
4. Distinguish between the event date and the reporting date
5. If multiple dates are mentioned, identify the primary event date

OUTPUT FORMAT (JSON):
{
  "eventDate": "YYYY-MM-DD", 
  "confidence": "high|medium|low",
  "context": "brief explanation of how date was determined",
  "timeReferences": ["list", "of", "key", "temporal", "phrases", "found"]
}

REQUIREMENTS:
- Only return eventDate if you are confident about the date
- Use "high" confidence only if explicit date is mentioned
- Use "medium" if date can be reasonably inferred
- Use "low" or null if uncertain
- Return null for eventDate if no clear date found

Analyze the content and extract the event date:`;

    const { result } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      dateExtractionPrompt
    );
    
    const response = result.response.text().trim();
    
    try {
      // Clean up markdown-wrapped JSON responses
      let cleanResponse = response;
      if (response.includes('```json')) {
        cleanResponse = response.replace(/```json\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
      } else if (response.includes('```')) {
        cleanResponse = response.replace(/```\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
      }
      
      const analysis = JSON.parse(cleanResponse);
      
      if (analysis.eventDate) {
        const eventDate = new Date(analysis.eventDate);
        
        // Validate date is reasonable (not in future, not too old)
        const now = new Date();
        const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        
        if (eventDate <= now && eventDate >= oneYearAgo) {
          return {
            eventDate: eventDate,
            confidence: analysis.confidence || 'medium',
            context: analysis.context || 'Date extracted from article content',
            timeReferences: analysis.timeReferences || []
          };
        }
      }
    } catch (parseError) {
      console.log(`      ⚠️ Date extraction JSON parse error: ${parseError.message}`);
    }
    
  } catch (error) {
    console.log(`      ❌ Date extraction AI error: ${error.message}`);
  }
  
  return {
    eventDate: null,
    confidence: 'low',
    context: 'Could not determine event date from content',
    timeReferences: []
  };
};

/**
 * Extract publication date from Google search result (DEPRECATED - now using content analysis)
 */
const extractPublicationDate = (item) => {
  // Try multiple date sources from Google search result
  const dateSources = [
    item.pagemap?.metatags?.[0]?.['article:published_time'],
    item.pagemap?.metatags?.[0]?.['pubdate'],
    item.pagemap?.metatags?.[0]?.['date'],
    item.pagemap?.newsarticle?.[0]?.datepublished,
    item.snippet.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/)?.[0]
  ];
  
  for (const dateStr of dateSources) {
    if (dateStr) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime()) && date.getTime() > 0) {
          return date;
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  return null;
};

/**
 * Analyze article timeline to determine event age (Updated for content-based date extraction)
 */
const analyzeArticleTimeline = (articles) => {
  if (articles.length === 0) {
    return {
      ageDays: null,
      confidence: 'low',
      earliestDate: null,
      latestDate: null,
      timeline: [],
      sourceCount: 0,
      articlesAnalyzed: []
    };
  }
  
  // Sort articles by event date (oldest first) and filter out articles without event dates
  const sortedArticles = articles.filter(a => a.eventDate && a.ageInDays !== null)
    .sort((a, b) => b.ageInDays - a.ageInDays);
  
  if (sortedArticles.length === 0) {
    return {
      ageDays: null,
      confidence: 'low',
      earliestDate: null,
      latestDate: null,
      timeline: [],
      sourceCount: 0,
      articlesAnalyzed: articles.map(a => ({
        title: a.title?.substring(0, 60) + '...',
        source: a.source,
        reason: 'No event date found in content'
      }))
    };
  }
  
  const oldestArticle = sortedArticles[0];
  const newestArticle = sortedArticles[sortedArticles.length - 1];
  const sourceCount = new Set(articles.map(a => a.source)).size;
  
  // Determine confidence based on article count, source diversity, and date confidence
  let confidence = 'low';
  const highConfidenceArticles = sortedArticles.filter(a => a.eventDateConfidence === 'high').length;
  const mediumConfidenceArticles = sortedArticles.filter(a => a.eventDateConfidence === 'medium').length;
  
  if (highConfidenceArticles >= 2 && sourceCount >= 3) {
    confidence = 'high';
  } else if ((highConfidenceArticles >= 1 || mediumConfidenceArticles >= 2) && sourceCount >= 2) {
    confidence = 'medium';
  }
  
  // Group articles by event date for consensus analysis
  const dailyArticleCounts = {};
  sortedArticles.forEach(article => {
    const dayKey = article.eventDate.toISOString().split('T')[0];
    if (!dailyArticleCounts[dayKey]) {
      dailyArticleCounts[dayKey] = { count: 0, confidenceSum: 0, articles: [] };
    }
    dailyArticleCounts[dayKey].count++;
    dailyArticleCounts[dayKey].articles.push(article);
    
    // Add confidence score (high=3, medium=2, low=1)
    const confScore = article.eventDateConfidence === 'high' ? 3 : 
                     article.eventDateConfidence === 'medium' ? 2 : 1;
    dailyArticleCounts[dayKey].confidenceSum += confScore;
  });
  
  // Find the date with highest confidence score (weighted by count and confidence)
  const timeline = Object.entries(dailyArticleCounts)
    .map(([date, data]) => ({ 
      date, 
      count: data.count, 
      confidenceScore: data.confidenceSum,
      ageInDays: Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)),
      articles: data.articles.map(a => ({ source: a.source, confidence: a.eventDateConfidence }))
    }))
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
  
  // Use the date with highest confidence score as the event age
  const eventAge = timeline.length > 0 ? timeline[0].ageInDays : oldestArticle.ageInDays;
  
  return {
    ageDays: eventAge,
    confidence: confidence,
    earliestDate: oldestArticle.eventDate.toISOString(),
    latestDate: newestArticle.eventDate.toISOString(),
    timeline: timeline,
    sourceCount: sourceCount,
    articlesAnalyzed: sortedArticles.map(a => ({
      title: a.title?.substring(0, 60) + '...',
      source: a.source,
      eventDate: a.eventDate.toLocaleDateString(),
      ageInDays: a.ageInDays,
      confidence: a.eventDateConfidence,
      context: a.eventContext
    }))
  };
};

/**
 * Search Reddit to determine claim age based on when discussions started (DEPRECATED - keeping for fallback)
 */
const searchRedditForClaimAge = async (claim) => {
  console.log(`📅 Searching Reddit to determine age of claim: ${claim.substring(0, 50)}...`);
  
  // Check cache first
  const cacheKey = `reddit_age_${claim.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  if (redditSearchCache.has(cacheKey)) {
    console.log('📋 Using cached Reddit age results');
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
    
    console.log(`🔎 Reddit age search terms: "${searchTerms}"`);
    
    // Search news-focused subreddits for timeline analysis
    const newSubreddits = [
      'news',
      'worldnews', 
      'politics',
      'breakingnews',
      'nottheonion',
      'OutOfTheLoop'
    ];
    
    let allPosts = [];
    
    // Try multiple search strategies to catch older posts
    const searchStrategies = [
      { sort: 'new', t: 'month', description: 'newest in past month' },
      { sort: 'relevance', t: 'month', description: 'most relevant in past month' },
      { sort: 'top', t: 'month', description: 'top posts in past month' }
    ];
    
    for (const subreddit of newSubreddits.slice(0, 3)) { // Focus on 3 main subreddits
      for (const strategy of searchStrategies) {
        try {
          const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json`;
          const params = {
            q: searchTerms,
            sort: strategy.sort,
            limit: 50,
            t: strategy.t
          };
          
          console.log(`    🔍 Trying r/${subreddit} with ${strategy.description}...`);
          
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
              .map(post => {
                const postAge = Math.floor((Date.now() / 1000 - post.created_utc) / 86400);
                return {
                  subreddit: post.subreddit,
                  title: post.title,
                  created_utc: post.created_utc,
                  score: post.score,
                  num_comments: post.num_comments,
                  url: `https://reddit.com${post.permalink}`,
                  ageInDays: postAge
                };
              });
            
            // Log date range of found posts
            if (posts.length > 0) {
              const oldestPost = Math.max(...posts.map(p => p.ageInDays));
              const newestPost = Math.min(...posts.map(p => p.ageInDays));
              console.log(`      📊 Found ${posts.length} posts (${newestPost}-${oldestPost} days old)`);
              
              // Log some sample dates for debugging
              const samplePosts = posts.slice(0, 3);
              samplePosts.forEach((post, i) => {
                const postDate = new Date(post.created_utc * 1000).toLocaleDateString();
                console.log(`      ${i + 1}. "${post.title.substring(0, 40)}..." (${postDate}, ${post.ageInDays} days ago)`);
              });
            }
            
            allPosts = allPosts.concat(posts);
          }
          
          // Rate limiting between searches
          await new Promise(resolve => setTimeout(resolve, 800));
        
        } catch (error) {
          console.log(`    ⚠️ Error searching r/${subreddit} with ${strategy.description}:`, error.message);
        }
      }
    }
    
    // Analyze post timestamps to determine ACTUAL EVENT AGE (not just discussion age)
    if (allPosts.length === 0) {
      console.log(`⚠️ No Reddit posts found for age analysis`);
      return {
        estimatedAgeDays: null,
        confidence: 'low',
        earliestPostDate: null,
        totalPosts: 0,
        searchTerms: searchTerms
      };
    }
    
    // Sort by creation time (oldest first)
    allPosts.sort((a, b) => a.created_utc - b.created_utc);
    
    const now = Date.now() / 1000; // Convert to Unix timestamp
    
    // ENHANCED: Look for the original news spike, not just earliest post
    const eventDetection = detectActualEventAge(allPosts, now);
    
    const earliestPost = allPosts[0];
    const latestPost = allPosts[allPosts.length - 1];
    
    const earliestDate = new Date(earliestPost.created_utc * 1000);
    const latestDate = new Date(latestPost.created_utc * 1000);
    
    // Use detected event age if available, otherwise fall back to earliest post
    const ageInDays = eventDetection.eventAgeDays || Math.floor((now - earliestPost.created_utc) / 86400);
    
    // Determine confidence based on post distribution and volume
    let confidence = 'low';
    if (allPosts.length >= 5) {
      // Check if posts are clustered around the same time period
      const timeSpan = latestPost.created_utc - earliestPost.created_utc;
      const timeSpanDays = timeSpan / 86400;
      
      if (timeSpanDays <= 30 && allPosts.length >= 10) {
        confidence = 'high'; // Lots of posts in short timeframe
      } else if (timeSpanDays <= 90 && allPosts.length >= 5) {
        confidence = 'medium'; // Some posts in reasonable timeframe
      }
    }
    
    const result = {
      estimatedAgeDays: ageInDays,
      confidence: confidence,
      earliestPostDate: earliestDate.toISOString(),
      latestPostDate: latestDate.toISOString(),
      totalPosts: allPosts.length,
      searchTerms: searchTerms,
      postTimespan: Math.floor((latestPost.created_utc - earliestPost.created_utc) / 86400),
      samplePosts: allPosts.slice(0, 3).map(post => ({
        title: post.title,
        subreddit: post.subreddit,
        date: new Date(post.created_utc * 1000).toLocaleDateString(),
        score: post.score
      })),
      // NEW: Enhanced event detection information
      eventDetection: eventDetection,
      ageDetectionMethod: eventDetection.method || 'earliest_post'
    };
    
    // Cache results for 2 hours
    redditSearchCache.set(cacheKey, result);
    setTimeout(() => redditSearchCache.delete(cacheKey), 7200000);
    
    console.log(`📊 Reddit age analysis: ${ageInDays} days old (${confidence} confidence, ${allPosts.length} posts)`);
    console.log(`📅 Earliest mention: ${earliestDate.toLocaleDateString()}, Latest: ${latestDate.toLocaleDateString()}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in Reddit age analysis:', error);
    return {
      estimatedAgeDays: null,
      confidence: 'low',
      earliestPostDate: null,
      totalPosts: 0,
      searchTerms: '',
      error: error.message
    };
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
 * Search for fact-checks using Google Fact Check Tools API with Google Custom Search enhanced timeline strategy
 */
const searchFactChecks = async (claim, videoUrl = '', caption = '', transcription = '') => {
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
  
  // NEW: Use Google Custom Search to determine claim age from actual news articles
  console.log(`🔍 Step 1: Using Google Search to determine claim age from news articles...`);
  const googleAgeAnalysis = await searchGoogleForClaimAge(claim, videoUrl, caption, transcription);
  
  // Enhanced timeline strategies based on Google news age analysis
  let timelineStrategies = [
    { maxAgeDays: 30, description: "last 30 days" },
    { maxAgeDays: 90, description: "last 90 days" },
    { maxAgeDays: 365, description: "last year" },
    { maxAgeDays: 1825, description: "last 5 years" }, // 5 years
    { description: "all time" } // No maxAgeDays = search all time
  ];
  
  // Optimize search strategy based on Google news findings
  let searchStrategy = 0;
  if (googleAgeAnalysis.estimatedAgeDays && googleAgeAnalysis.confidence !== 'low') {
    const googleAge = googleAgeAnalysis.estimatedAgeDays;
    
    console.log(`📊 Google analysis: Claim is ~${googleAge} days old (${googleAgeAnalysis.confidence} confidence)`);
    console.log(`📅 Based on ${googleAgeAnalysis.totalArticles} news articles from ${googleAgeAnalysis.timeline?.length || 0} different dates`);
    
    // Create targeted search strategy based on Google news age
    if (googleAge <= 45) {
      // Recent claim - start with short timeframes
      timelineStrategies = [
        { maxAgeDays: Math.max(60, googleAge + 15), description: `targeted: ${Math.max(60, googleAge + 15)} days (Google-based)` },
        { maxAgeDays: 90, description: "last 90 days" },
        { maxAgeDays: 365, description: "last year" },
        { description: "all time" }
      ];
      searchStrategy = 0;
    } else if (googleAge <= 180) {
      // Medium-age claim
      timelineStrategies = [
        { maxAgeDays: Math.max(200, googleAge + 20), description: `targeted: ${Math.max(200, googleAge + 20)} days (Google-based)` },
        { maxAgeDays: 365, description: "last year" },
        { maxAgeDays: 1825, description: "last 5 years" },
        { description: "all time" }
      ];
      searchStrategy = 0;
    } else if (googleAge <= 730) {
      // Older claim - start with year+ searches
      timelineStrategies = [
        { maxAgeDays: Math.max(800, googleAge + 70), description: `targeted: ${Math.max(800, googleAge + 70)} days (Google-based)` },
        { maxAgeDays: 1825, description: "last 5 years" },
        { description: "all time" }
      ];
      searchStrategy = 0;
    } else {
      // Very old claim - start with multi-year search
      searchStrategy = 1; // Start with "last 5 years"
      timelineStrategies.unshift({ 
        maxAgeDays: Math.max(1900, googleAge + 100), 
        description: `targeted: ${Math.max(1900, googleAge + 100)} days (Google-based)` 
      });
    }
    
    console.log(`🎯 Optimized search strategy based on Google news age: starting with ${timelineStrategies[searchStrategy].description}`);
    
  } else {
    console.log(`⚠️ Google age analysis inconclusive (${googleAgeAnalysis.totalArticles} articles), using fallback video detection`);
    
    // Fallback to original video age detection
    const ageDetection = detectVideoAge(videoUrl, caption);
    searchStrategy = ageDetection.startStrategy;
    
    console.log(`🎯 Using video-based strategy ${searchStrategy} as fallback`);
  }
  
  // Store fallback age detection for return value
  let fallbackAgeDetection = null;
  if (!googleAgeAnalysis.estimatedAgeDays || googleAgeAnalysis.confidence === 'low') {
    fallbackAgeDetection = detectVideoAge(videoUrl, caption);
  }
  
  let allResults = [];
  
  console.log(`🔍 Step 2: Searching fact-check databases with optimized timeline...`);
  
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
    estimatedVideoAge: fallbackAgeDetection?.estimatedAge || null, // Fallback age detection
    googleAgeAnalysis: googleAgeAnalysis // NEW: Include Google news age analysis
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
    
    // AGGRESSIVE CLEANUP: Remove all noise elements first
    $(
      'script, style, noscript, iframe, embed, object, ' +
      'nav, header, footer, aside, menu, ' +
      '.advertisement, .ads, .ad, .social-share, .comments, .comment, ' +
      '.sidebar, .nav, .navigation, .breadcrumb, .related, .recommendation, .related-articles, ' +
      '.popup, .modal, .overlay, .banner, .cookie, ' +
      '[class*="ad-"], [class*="ads-"], [id*="ad-"], [id*="ads-"], ' +
      '[class*="social"], [class*="share"], [class*="follow"], ' +
      '[class*="newsletter"], [class*="subscribe"], [class*="signup"], ' +
      'button, input, select, textarea, form, ' +
      '.gallery, .video, .audio, .player, ' +
      '[style*="display: none"], [style*="visibility: hidden"]'
    ).remove();
    
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
    
    // ADVANCED CONTENT CLEANING
    content = content
      // Remove multiple whitespaces
      .replace(/\s+/g, ' ')
      // Remove newlines
      .replace(/\n+/g, ' ')
      // Remove common noise patterns
      .replace(/Subscribe to our newsletter.*?$/gi, '')
      .replace(/Follow us on.*?$/gi, '')
      .replace(/Share this article.*?$/gi, '')
      .replace(/Advertisement.*?$/gi, '')
      .replace(/Cookie policy.*?$/gi, '')
      .replace(/Privacy policy.*?$/gi, '')
      .replace(/Terms of service.*?$/gi, '')
      .replace(/Sign up for.*?$/gi, '')
      .replace(/Download our app.*?$/gi, '')
      // Remove navigation text
      .replace(/Home\s+News\s+Sports\s+/gi, '')
      .replace(/Menu\s+Search\s+/gi, '')
      // Remove repetitive elements
      .replace(/(\b\w+\b)(\s+\1\b){2,}/gi, '$1') // Remove word repetition
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
 * NEW: Reddit gets 0 weight when articles are present, article content prioritized over verdicts
 */
const analyzeFactChecks = async (factCheckResults, originalClaim, videoAnalysis = null, logicalConsistency = null) => {
  console.log(`📊 Analyzing fact-check results with article content prioritization over verdicts...`);
  
  // Check if we have fact-check articles
  const hasFactCheckArticles = factCheckResults.claims && factCheckResults.claims.length > 0;
  
  // NEW: Check if we have Google search articles with content
  const hasGoogleArticles = factCheckResults.googleAgeAnalysis && 
                            factCheckResults.googleAgeAnalysis.articlesWithContent && 
                            factCheckResults.googleAgeAnalysis.articlesWithContent.length > 0;
  
  if (hasGoogleArticles) {
    console.log(`📰 Found ${factCheckResults.googleAgeAnalysis.articlesWithContent.length} Google search articles with content for equal weight analysis`);
  }
  
  // Reddit analysis for informational purposes, but gets 0 weight if articles are present
  let redditAnalysis = null;
  try {
    console.log('🔄 Running Reddit analysis for informational purposes...');
    const redditResults = await searchRedditForVerification(originalClaim);
    if (redditResults.total_posts > 0) {
      redditAnalysis = await analyzeRedditSentiment(redditResults, originalClaim);
      console.log(`📊 Reddit sentiment: ${redditAnalysis.sentiment} (${(redditAnalysis.confidence * 100).toFixed(0)}% confidence)`);
      
      // If no fact-check articles and no Google articles, Reddit can still provide fallback verdict
      if (!hasFactCheckArticles && !hasGoogleArticles) {
        console.log('📰 No fact-check articles found - using Reddit as primary source');
        
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
      } else {
        console.log('📰 Articles found (fact-check or Google search) - Reddit analysis will have 0 weight in final verdict');
      }
    }
  } catch (error) {
    console.error('❌ Reddit analysis failed:', error);
  }
  
  // If no fact-check articles, no Google articles, and no Reddit results
  if (!hasFactCheckArticles && !hasGoogleArticles) {
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
  
  const claims = factCheckResults.claims || [];
  const allSources = [];
  
  // Extract all fact-check sources with review dates
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
            publisherSite: review.publisher?.site || '',
            sourceType: 'factcheck'
          });
        }
      });
    }
  });
  
  // NEW: Add Google search articles with EQUAL WEIGHT
  if (hasGoogleArticles) {
    const googleArticles = factCheckResults.googleAgeAnalysis.articlesWithContent;
    console.log(`🔍 Adding ${googleArticles.length} Google search articles to analysis with equal weight...`);
    
    googleArticles.forEach(article => {
      allSources.push({
        publisher: article.source || 'Unknown',
        url: article.link,
        title: article.title || '',
        rating: 'UNRATED', // Google articles don't have pre-existing ratings
        reviewDate: article.eventDate ? article.eventDate.toISOString().split('T')[0] : '1970-01-01',
        publisherSite: article.source || '',
        sourceType: 'google_search',
        content: article.content, // Pre-scraped content
        eventDateConfidence: article.eventDateConfidence,
        eventContext: article.eventContext
      });
    });
    
    console.log(`📰 Total sources for analysis: ${allSources.length} (${claims.length ? claims.reduce((sum, claim) => sum + (claim.claimReview?.length || 0), 0) : 0} fact-check + ${googleArticles.length} Google search)`);
  }
  
  // Sort by date - LATEST FIRST (this is the key change!)
  allSources.sort((a, b) => {
    return new Date(b.reviewDate) - new Date(a.reviewDate);
  });
  
  console.log(`📅 Found ${allSources.length} sources, prioritizing latest articles:`);
  allSources.slice(0, 3).forEach((source, index) => {
    console.log(`  ${index + 1}. ${source.publisher} (${source.reviewDate}) - ${source.rating}`);
  });
  
  // Analyze ALL articles for content-based verdicts (not just the latest)
  console.log(`🔍 Analyzing content from all ${allSources.length} articles for AI inference...`);
  const articleAnalyses = [];
  let latestArticleAnalysis = null;
  
  // Process multiple articles in parallel (limit to top 3 for performance)
  const articlesToAnalyze = allSources.slice(0, 3);
  const analysisPromises = articlesToAnalyze.map(async (source, index) => {
    try {
      console.log(`📰 Analyzing article ${index + 1}: ${source.publisher} (${source.reviewDate}) - ${source.sourceType}`);
      
      // Use pre-scraped content for Google articles, or scrape for fact-check articles
      let articleContent;
      if (source.sourceType === 'google_search' && source.content) {
        console.log(`  ✅ Using pre-scraped content from Google search`);
        articleContent = source.content;
      } else {
        console.log(`  🔍 Scraping content for ${source.sourceType} article`);
        articleContent = await scrapeArticleContent(source.url, source.title);
      }
      
      if (articleContent) {
        // Get AI's independent analysis of the article
        const aiInference = await analyzeArticleContent(
          articleContent,
          originalClaim,
          source.title,
          source.publisher,
          source.url
        );
        
        const analysis = {
          source: source,
          fullContent: articleContent.substring(0, 1000) + '...', // Truncate for storage
          aiAnalysis: aiInference,
          index: index
        };
        
        // Track the latest article analysis separately
        if (index === 0) {
          latestArticleAnalysis = analysis;
        }
        
        return analysis;
      }
    } catch (error) {
      console.error(`❌ Error analyzing article ${index + 1} (${source.publisher}):`, error.message);
    }
    return null;
  });
  
  // Wait for all article analyses to complete
  const completedAnalyses = (await Promise.all(analysisPromises)).filter(Boolean);
  articleAnalyses.push(...completedAnalyses);
  
  console.log(`✅ Completed AI analysis for ${articleAnalyses.length} articles`);
  
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
  
  // Calculate weighted verdict with ARTICLE CONTENT prioritized over fact-check verdicts
  let falseScore = 0, trueScore = 0, mixedScore = 0, totalWeight = 0;
  const analysisData = [];
  
  console.log(`🎯 NEW WEIGHTING STRATEGY: Article content analysis prioritized, Google articles get EQUAL weight`);
  
  allSources.forEach((source, index) => {
    const publisherName = (source.publisher || 'Unknown').toLowerCase();
    let baseWeight = publisherWeights[publisherName] || 0.5;
    
    // EQUAL WEIGHT for Google articles: Give them same credibility as established sources
    if (source.sourceType === 'google_search') {
      baseWeight = 0.8; // High base weight for Google search articles
      console.log(`🔍 Google search article gets equal weight: ${source.publisher} (base weight: ${baseWeight})`);
    }
    
    // LATEST ARTICLE WEIGHTING - exponentially higher weight for recent articles
    let recencyMultiplier = 1.0;
    if (index === 0) recencyMultiplier = 3.0;      // Latest article gets 3x weight
    else if (index === 1) recencyMultiplier = 2.0; // Second latest gets 2x weight
    else if (index === 2) recencyMultiplier = 1.5; // Third latest gets 1.5x weight
    
    const effectiveWeight = baseWeight * recencyMultiplier;
    
    // Find AI analysis for this source (PRIORITY: Article content over verdict)
    const aiAnalysis = articleAnalyses.find(analysis => analysis.index === index);
    let normalizedRating = 'unknown';
    let confidence = 0.5;
    let verdictSource = 'traditional_rating';
    
    if (aiAnalysis && aiAnalysis.aiAnalysis) {
      // PRIORITIZE: AI analysis of article content over traditional fact-check verdicts
      const aiInference = aiAnalysis.aiAnalysis;
      verdictSource = 'article_content_ai';
      
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
        default:
          // If AI analysis is insufficient, fall back to traditional rating with reduced weight
          verdictSource = 'ai_insufficient_fallback';
          confidence = 0.3; // Reduced confidence for fallback
      }
      
      console.log(`🤖 Article ${index + 1} (${source.publisher}): Using AI content analysis - ${normalizedRating} (${confidence}) [${verdictSource}]`);
      
    } else {
      // Fallback to traditional rating analysis when no article content analysis
      const rating = source.rating.toLowerCase();
      
      // Special handling for Google articles without AI analysis
      if (source.sourceType === 'google_search' && rating === 'unrated') {
        normalizedRating = 'unknown';
        confidence = 0.2; // Low confidence for Google articles without AI analysis
        verdictSource = 'google_no_ai_analysis';
        console.log(`🔍 Article ${index + 1} (${source.publisher}): Google search article without AI analysis - skipping [${verdictSource}]`);
      } else {
        // Traditional fact-check ratings
        confidence = 0.4; // Reduced base confidence for traditional ratings
        
        if (rating.includes('false') || rating.includes('incorrect') || rating.includes('misleading') || 
            rating.includes('pants on fire') || rating.includes('fake') || rating.includes('fabricated')) {
          normalizedRating = 'false';
        } else if (rating.includes('true') || rating.includes('correct') || rating.includes('accurate') || 
                   rating.includes('verified') || rating.includes('confirmed')) {
          normalizedRating = 'true';
        } else if (rating.includes('partially') || rating.includes('mixed') || rating.includes('half') || 
                   rating.includes('mostly') || rating.includes('some')) {
          normalizedRating = 'mixed';
        }
        
        console.log(`📰 Article ${index + 1} (${source.publisher}): Using traditional rating - ${normalizedRating} (${confidence}) [${verdictSource}]`);
      }
    }
    
    // Apply logical consistency adjustment only to latest article with AI analysis
    let logicalAdjustment = 0;
    if (logicalConsistency && index === 0 && aiAnalysis) {
      logicalAdjustment = logicalConsistency.weight_adjustment || 0;
      console.log(`🧠 Applying logical consistency adjustment to latest article: ${logicalAdjustment}`);
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
      verdictSource,
      isLatest: index === 0,
      hasAIAnalysis: !!aiAnalysis
    });
  });
  
  console.log(`📊 Weighting Summary: ${analysisData.filter(a => a.hasAIAnalysis).length}/${allSources.length} sources used AI content analysis`);
  
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
    
    // Boost confidence if multiple articles have AI content analysis
    const aiAnalysisCount = analysisData.filter(a => a.hasAIAnalysis).length;
    const highConfidenceAICount = articleAnalyses.filter(a => a.aiAnalysis?.confidence === 'HIGH').length;
    
    if (highConfidenceAICount >= 2 && overallConfidence !== 'High') {
      overallConfidence = 'High';
      console.log(`🚀 Confidence boosted to High: ${highConfidenceAICount} articles with high-confidence AI analysis`);
    } else if (aiAnalysisCount >= 2 && overallConfidence === 'Low') {
      overallConfidence = 'Medium';
      console.log(`📈 Confidence boosted to Medium: ${aiAnalysisCount} articles with AI content analysis`);
    } else if (latestArticleAnalysis && latestArticleAnalysis.aiAnalysis?.confidence === 'HIGH' && overallConfidence !== 'High') {
      overallConfidence = 'Medium';
      console.log(`📈 Confidence boosted to Medium: Latest article has high-confidence AI analysis`);
    }
  }
  
  const summary = generateContentPrioritizedSummary(primaryVerdict, overallConfidence, allSources.length, articleAnalyses, latestArticleAnalysis, factCheckResults);
  
  return {
    verdict: primaryVerdict,
    confidence: overallConfidence,
    summary,
    sources: allSources.slice(0, 4), // Top 4 sources (latest first)
    latestArticleAnalysis,
    allArticleAnalyses: articleAnalyses, // NEW: All AI content analyses
    videoAnalysis: videoAnalysis,
    logicalConsistency: logicalConsistency,
    redditAnalysis: redditAnalysis, // Note: Has 0 weight when articles are present
    analysisDetails: {
      totalSources: allSources.length,
      contentAnalysisPrioritized: true, // NEW: Flag indicating content over verdict priority
      articlesWithAIAnalysis: analysisData.filter(a => a.hasAIAnalysis).length,
      redditWeight: hasFactCheckArticles ? 0 : 1, // NEW: Shows Reddit gets 0 weight when articles present
      falseRatio: totalWeight > 0 ? (falseScore / totalWeight).toFixed(2) : '0',
      trueRatio: totalWeight > 0 ? (trueScore / totalWeight).toFixed(2) : '0',
      mixedRatio: totalWeight > 0 ? (mixedScore / totalWeight).toFixed(2) : '0',
      aiContentAnalysisUsed: articleAnalyses.length > 0, // NEW: Multiple AI analyses
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
 * Generate content-prioritized summary based on analysis (NEW: Emphasizes article content over verdicts)
 */
const generateContentPrioritizedSummary = (verdict, confidence, sourceCount, articleAnalyses, latestArticleAnalysis, factCheckResults = null) => {
  let summary = `📊 **CONTENT-PRIORITIZED ANALYSIS** (article content weighted higher than verdicts)\n\n`;
  
  const aiAnalysisCount = articleAnalyses.length;
  const highConfidenceCount = articleAnalyses.filter(a => a.aiAnalysis?.confidence === 'HIGH').length;
  
  if (aiAnalysisCount > 0) {
    summary += `🤖 **AI Content Analysis**: Analyzed full content from ${aiAnalysisCount} article${aiAnalysisCount !== 1 ? 's' : ''}\n`;
    
    if (highConfidenceCount > 0) {
      summary += `🎯 **High Confidence**: ${highConfidenceCount} article${highConfidenceCount !== 1 ? 's' : ''} provided high-confidence analysis\n`;
    }
    
    // Show breakdown of AI verdicts
    const aiVerdicts = articleAnalyses.map(a => a.aiAnalysis?.verdict).filter(Boolean);
    if (aiVerdicts.length > 1) {
      const verdictCounts = aiVerdicts.reduce((acc, v) => {
        acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {});
      summary += `📈 **Content Verdict Distribution**: ${Object.entries(verdictCounts).map(([v, c]) => `${v}(${c})`).join(', ')}\n`;
    }
    summary += `\n`;
  }
  
  if (latestArticleAnalysis && latestArticleAnalysis.aiAnalysis) {
    const latestSource = latestArticleAnalysis.source;
    const aiInference = latestArticleAnalysis.aiAnalysis;
    
    summary += `🔍 **Latest Article Deep-Dive**: ${latestSource.publisher} (${latestSource.reviewDate})\n`;
    summary += `🤖 **AI Content Assessment**: ${aiInference.verdict} (${aiInference.confidence} confidence)\n`;
    summary += `📋 **Evidence Found**: ${aiInference.evidence_summary}\n\n`;
    
    if (aiInference.key_facts && aiInference.key_facts.length > 0) {
      summary += `🎯 **Key Facts from Latest Article**:\n`;
      aiInference.key_facts.slice(0, 3).forEach((fact, index) => {
        summary += `  ${index + 1}. ${fact}\n`;
      });
      summary += `\n`;
    }
  }
  
  // Overall verdict with new emphasis
  summary += `⭐ **FINAL VERDICT**: `;
  switch (verdict) {
    case 'True':
      summary += `**CONFIRMED TRUE** - Article content analysis supports this claim`;
      break;
    case 'False':
      summary += `**DEBUNKED FALSE** - Article content analysis contradicts this claim`;
      break;
    case 'Mixed':
      summary += `**MIXED ACCURACY** - Article content shows partial truth with important caveats`;
      break;
    default:
      summary += `**INCONCLUSIVE** - Article content insufficient to determine accuracy`;
  }
  
  summary += `\n📈 **Confidence Level**: ${confidence}`;
  
  if (aiAnalysisCount > 0) {
    summary += ` (Based on AI analysis of ${aiAnalysisCount} full article${aiAnalysisCount !== 1 ? 's' : ''})`;
  }
  
  summary += `\n\n📚 **Analysis Method**: Content-first approach - article content prioritized over verdict labels`;
  summary += `\n🔍 **Sources Analyzed**: ${sourceCount} total (${aiAnalysisCount} with full content analysis)`;
  summary += `\n⚠️ **Reddit Weight**: 0 (Reddit analysis provided for context only when fact-check articles are present)`;
  
  // Add timeline search information if available
  if (factCheckResults && factCheckResults.searchStrategy) {
    summary += `\n🔍 **Search Strategy**: Found results using ${factCheckResults.searchStrategy.description} search`;
    if (factCheckResults.totalStrategiesTried > 1) {
      summary += ` (tried ${factCheckResults.totalStrategiesTried} timeline strategies)`;
    }
    
    // NEW: Include Google age analysis information
    if (factCheckResults.googleAgeAnalysis) {
      const google = factCheckResults.googleAgeAnalysis;
      if (google.estimatedAgeDays && google.confidence !== 'low') {
        summary += `\n📅 **Claim Age**: ~${google.estimatedAgeDays} days old (${google.confidence} confidence from Google news analysis)`;
        summary += `\n📰 **News Timeline**: ${google.totalArticles} articles found from ${google.timeline?.length || 1} different dates`;
        if (google.sampleArticles && google.sampleArticles.length > 0) {
          summary += `\n📋 **Key Sources**: ${google.sampleArticles.slice(0, 3).map(a => a.source).join(', ')}`;
        }
      } else if (google.totalArticles > 0) {
        summary += `\n📰 **News Search**: Found ${google.totalArticles} articles, but age analysis inconclusive`;
      } else {
        summary += `\n🔍 **Age Detection**: Used video metadata (Google news search found no articles)`;
      }
    }
    
    if (factCheckResults.estimatedVideoAge) {
      summary += `\n📺 **Video Age**: ~${factCheckResults.estimatedVideoAge} days old (from metadata)`;
    }
  }
  
  return summary;
};

/**
 * Generate latest-focused summary based on analysis (LEGACY - kept for compatibility)
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
 * Search user's fact-check history for relevant content using semantic matching
 */
const searchFactCheckMemory = async (userId, userQuery) => {
  console.log(`🔍 Searching fact-check memory for user ${userId}: "${userQuery}"`);
  
  const userHistory = getUserFactCheckHistory(userId);
  
  if (!userHistory || userHistory.length === 0) {
    console.log(`📭 No fact-check history found for user ${userId}`);
    return [];
  }
  
  try {
    // Use Gemini AI to find semantically similar fact-checks
    const prompt = `You are an AI assistant helping users find relevant fact-checks from their history. 

USER QUERY: "${userQuery}"

FACT-CHECK HISTORY:
${userHistory.map((check, index) => 
  `${index + 1}. CLAIM: "${check.result.claim}"
   VERDICT: ${check.result.analysis.verdict}
   DATE: ${new Date(check.timestamp).toLocaleDateString()}
   SUMMARY: ${check.result.analysis.summary ? check.result.analysis.summary.substring(0, 200) + '...' : 'No summary'}
   ---`
).join('\n')}

TASK: Find the most relevant fact-checks that relate to the user's query. Consider:
- Semantic similarity (similar topics, people, events)  
- Keywords and entities mentioned
- Context and intent of the user's question

OUTPUT: Return a JSON array with the indices (0-based) of the most relevant fact-checks, ordered by relevance.
If no relevant fact-checks are found, return an empty array.

EXAMPLES:
- Query "What about that election claim?" → Look for election-related fact-checks
- Query "Remember the vaccine thing?" → Look for vaccine/medical fact-checks  
- Query "That celebrity news" → Look for celebrity-related fact-checks

Provide ONLY the JSON array of indices: [0, 2, 5] or []`;

    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      prompt
    );
    
    const responseText = result.response.text().trim();
    
    try {
      const relevantIndices = JSON.parse(responseText);
      
      if (!Array.isArray(relevantIndices)) {
        console.log('⚠️ AI returned non-array result, falling back to keyword search');
        return keywordSearchMemory(userHistory, userQuery);
      }
      
      const relevantChecks = relevantIndices
        .filter(index => index >= 0 && index < userHistory.length)
        .map(index => userHistory[index]);
      
      console.log(`✅ Found ${relevantChecks.length} relevant fact-checks using AI semantic search`);
      return relevantChecks;
      
    } catch (jsonError) {
      console.log('⚠️ AI response not valid JSON, falling back to keyword search');
      return keywordSearchMemory(userHistory, userQuery);
    }
    
  } catch (error) {
    console.error('❌ Error in semantic search, falling back to keyword search:', error);
    return keywordSearchMemory(userHistory, userQuery);
  }
};

/**
 * Fallback keyword-based search for fact-check memory
 */
const keywordSearchMemory = (userHistory, userQuery) => {
  console.log(`🔤 Using keyword-based fallback search`);
  
  const queryWords = userQuery.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .filter(word => word.length > 2 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was', 'one', 'our', 'out'].includes(word));
  
  if (queryWords.length === 0) return [];
  
  const scoredResults = userHistory.map(check => {
    const searchText = `${check.result.claim} ${check.result.analysis.summary || ''}`.toLowerCase();
    let score = 0;
    
    queryWords.forEach(word => {
      if (searchText.includes(word)) {
        score += 1;
      }
    });
    
    return { check, score };
  });
  
  const relevantChecks = scoredResults
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(result => result.check);
  
  console.log(`✅ Found ${relevantChecks.length} relevant fact-checks using keyword search`);
  return relevantChecks;
};

/**
 * Generate conversational response about fact-checked content
 */
const generateConversationalResponse = async (userId, userQuery, relevantFactChecks) => {
  console.log(`💬 Generating conversational response for user ${userId}`);
  
  if (!relevantFactChecks || relevantFactChecks.length === 0) {
    return {
      found: false,
      response: "I don't see any previous fact-checks that relate to what you're asking about. Feel free to share more details or send me a new video to fact-check! 🔍"
    };
  }
  
  try {
    // Prepare context from relevant fact-checks
    const factCheckContext = relevantFactChecks.map((check, index) => {
      const analysis = check.result.analysis;
      return `FACT-CHECK #${index + 1}:
CLAIM: "${check.result.claim}"
VERDICT: ${analysis.verdict} 
CONFIDENCE: ${analysis.confidence}
DATE CHECKED: ${new Date(check.timestamp).toLocaleDateString()}
KEY FINDINGS: ${analysis.summary ? analysis.summary.substring(0, 300) : 'No detailed summary available'}
SOURCES: ${analysis.sources ? analysis.sources.slice(0, 2).map(s => s.publisher).join(', ') : 'None'}
---`;
    }).join('\n\n');
    
    const prompt = `You are a friendly, knowledgeable fact-checking assistant having a conversation with someone about news they previously asked you to verify. Respond in a natural, human-like way.

USER'S QUESTION: "${userQuery}"

RELEVANT FACT-CHECKS FROM THEIR HISTORY:
${factCheckContext}

INSTRUCTIONS:
1. **Be conversational and natural** - Talk like a knowledgeable friend, not a robot
2. **Reference their previous fact-checks** - Mention "Remember when you asked me about..." or "You fact-checked this before..."
3. **Give human-like insights** - Share what the evidence shows in plain language
4. **Be helpful and engaging** - Offer to explain more or fact-check related content
5. **Use appropriate emojis** - But don't overdo it, keep it natural
6. **Keep it concise** - 2-3 paragraphs maximum unless they ask for details

TONE: Friendly, informative, conversational - like you're chatting with a friend about news

AVOID:
- Robotic language like "Based on analysis" or "According to data"  
- Overly formal or technical language
- Just repeating the verdict without context
- Being preachy or judgmental

Example good response:
"Hey, remember when you asked me about that vaccine claim a couple weeks ago? That turned out to be false - the sources I found showed the numbers were completely made up. The real data from the CDC was totally different. Is there something specific about it you wanted to know more about? 🤔"

Generate a natural, conversational response:`;

    const { result, modelUsed } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.BALANCED,
      prompt
    );
    
    const conversationalResponse = result.response.text().trim();
    
    console.log(`✅ Generated conversational response (${conversationalResponse.length} chars)`);
    
    return {
      found: true,
      response: conversationalResponse,
      relevantChecks: relevantFactChecks
    };
    
  } catch (error) {
    console.error('❌ Error generating conversational response:', error);
    
    // Fallback to simple response
    const check = relevantFactChecks[0];
    const fallbackResponse = `I found that you previously fact-checked something related: "${check.result.claim}" 
    
The verdict was **${check.result.analysis.verdict}** with ${check.result.analysis.confidence} confidence. 

Want me to share more details about this, or do you have a new claim to fact-check? 🤔`;
    
    return {
      found: true,
      response: fallbackResponse,
      relevantChecks: relevantFactChecks
    };
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
 * Enhanced main function to process Instagram reel with comprehensive analysis
 */
const processInstagramReel = async (senderId, attachment) => {
  // Generate unique processing ID for this reel
  const reelProcessingId = uuidv4().substring(0, 8);
  
  console.log(`🎬 [${reelProcessingId}] Processing Instagram reel for user: ${senderId}`);
  console.log(`📱 [${reelProcessingId}] Reel URL: ${attachment.payload?.url || 'Not provided'}`);
  console.log(`📝 [${reelProcessingId}] Reel Caption: "${attachment.payload?.title || 'No caption'}" (${(attachment.payload?.title || '').length} chars)`);
  
  if (attachment.type !== 'ig_reel' || !attachment.payload?.url) {
    throw new Error(`[${reelProcessingId}] Invalid Instagram reel attachment`);
  }
  
  const videoUrl = attachment.payload.url;
  const caption = attachment.payload.title || '';
  const fileName = `${reelProcessingId}_${uuidv4()}.mp4`;
  
  console.log(`🔧 [${reelProcessingId}] Generated file name: ${fileName}`);
  
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
    console.log(`🧠 [${reelProcessingId}] Extracting verifiable claim from transcription...`);
    const claim = await extractClaim(transcription, caption);
    console.log(`🎯 [${reelProcessingId}] Extracted claim: "${claim}"`);
    
    if (claim === 'No verifiable claim found') {
      console.log(`❌ [${reelProcessingId}] No verifiable claims found - processing complete`);
      return {
        success: false,
        message: 'No verifiable claims found in this video to fact-check.',
        videoAnalysis: videoAnalysis, // Still provide video analysis
        reelProcessingId: reelProcessingId
      };
    }
    
    // Step 6: Search for fact-checks with timeline optimization
    console.log(`🔍 [${reelProcessingId}] Starting enhanced fact-check search with Google age detection...`);
    const factCheckResults = await searchFactChecks(claim, videoUrl, caption, transcription);
    
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
    
    console.log(`✅ [${reelProcessingId}] Fact-check processing complete!`);
    console.log(`📊 [${reelProcessingId}] Final verdict: ${analysis.verdict} (${analysis.confidence} confidence)`);
    
    return {
      success: true,
      claim,
      transcription,
      analysis,
      videoAnalysis,
      logicalConsistency,
      resultId,
      reelProcessingId: reelProcessingId
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
  analyzeFactChecks,
  // NEW: Memory and conversational features
  searchFactCheckMemory,
  generateConversationalResponse,
  // NEW: Google Custom Search age detection (replaces Reddit)
  searchGoogleForClaimAge,
  createSmartSearchQueries,
  analyzeArticleContentForClaim,
  extractEventDatesFromContent,
  analyzeArticleTimeline,
  // DEPRECATED: Reddit-based age detection (kept for fallback)
  searchRedditForClaimAge
};
