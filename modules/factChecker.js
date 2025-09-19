const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// In-memory storage for fact-check results
// In production, use a database like MongoDB or Redis
const factCheckMemory = new Map();

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
 * Transcribe audio using Gemini AI
 */
const transcribeAudio = async (audioPath) => {
  console.log(`🎤 Transcribing audio: ${audioPath}`);
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Read audio file as buffer
    const audioBuffer = await fs.readFile(audioPath);
    
    const prompt = "Transcribe this audio file and provide the exact spoken content. Return only the transcription text without any additional commentary.";
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: 'audio/mp3'
        }
      }
    ]);
    
    const transcription = result.response.text();
    console.log(`✅ Audio transcribed: ${transcription}`);
    return transcription;
  } catch (error) {
    console.error('❌ Error transcribing audio:', error);
    throw error;
  }
};

/**
 * Extract claim from transcription and caption using Gemini AI
 */
const extractClaim = async (transcription, caption) => {
  console.log(`🧠 Extracting claim from content...`);
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Analyze the following content and extract the main factual claim being made. Focus on claims that can be fact-checked (statements about events, people, statistics, etc.).

Transcription: "${transcription}"
Caption: "${caption}"

Return only the main claim as a concise, searchable statement. If multiple claims are present, prioritize the most significant one. If no factual claim is found, return "No verifiable claim found".`;
    
    const result = await model.generateContent(prompt);
    const claim = result.response.text().trim();
    
    console.log(`✅ Claim extracted: ${claim}`);
    return claim;
  } catch (error) {
    console.error('❌ Error extracting claim:', error);
    throw error;
  }
};

/**
 * Search for fact-checks using Google Fact Check Tools API
 */
const searchFactChecks = async (claim) => {
  console.log(`🔍 Searching fact-checks for: ${claim}`);
  
  const baseUrl = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
  const params = {
    query: claim,
    languageCode: 'en',
    maxAgeDays: 14,
    pageSize: 10,
    offset: 0,
    key: process.env.GOOGLE_FACTCHECK_API_KEY
  };
  
  try {
    const response = await axios.get(baseUrl, { params });
    console.log(`✅ Found ${response.data.claims?.length || 0} fact-check results`);
    return response.data;
  } catch (error) {
    console.error('❌ Error searching fact-checks:', error);
    throw error;
  }
};

/**
 * Analyze fact-check results and determine veracity
 */
const analyzeFactChecks = (factCheckResults) => {
  console.log(`📊 Analyzing fact-check results...`);
  
  if (!factCheckResults.claims || factCheckResults.claims.length === 0) {
    return {
      verdict: 'Unknown',
      confidence: 'Low',
      summary: 'No fact-check information available for this claim.',
      sources: []
    };
  }
  
  const claims = factCheckResults.claims;
  const ratings = [];
  const sources = [];
  
  // Extract ratings and sources
  claims.forEach(claim => {
    if (claim.claimReview && claim.claimReview.length > 0) {
      claim.claimReview.forEach(review => {
        if (review.textualRating) {
          ratings.push({
            rating: review.textualRating.toLowerCase(),
            publisher: review.publisher?.name || 'Unknown',
            url: review.url,
            title: review.title
          });
          sources.push({
            publisher: review.publisher?.name || 'Unknown',
            url: review.url,
            title: review.title,
            rating: review.textualRating
          });
        }
      });
    }
  });
  
  // Prioritize most recent results
  const latestClaim = claims[claims.length - 1];
  let primaryVerdict = 'Unknown';
  let confidence = 'Low';
  
  if (latestClaim && latestClaim.claimReview && latestClaim.claimReview.length > 0) {
    const latestReview = latestClaim.claimReview[0];
    const rating = latestReview.textualRating?.toLowerCase() || '';
    
    if (rating.includes('false') || rating.includes('incorrect') || rating.includes('misleading')) {
      primaryVerdict = 'False';
      confidence = 'High';
    } else if (rating.includes('true') || rating.includes('correct') || rating.includes('accurate')) {
      primaryVerdict = 'True';
      confidence = 'High';
    } else if (rating.includes('mixed') || rating.includes('partially')) {
      primaryVerdict = 'Mixed';
      confidence = 'Medium';
    }
  }
  
  const summary = generateSummary(primaryVerdict, sources.length, latestClaim);
  
  return {
    verdict: primaryVerdict,
    confidence,
    summary,
    sources: sources.slice(0, 3) // Limit to top 3 sources
  };
};

/**
 * Generate summary based on analysis
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
 * Main function to process Instagram reel
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
  
  try {
    // Step 1: Download video
    videoPath = await downloadVideo(videoUrl, fileName);
    
    // Step 2: Extract audio
    audioPath = await extractAudio(videoPath);
    
    // Step 3: Transcribe audio
    const transcription = await transcribeAudio(audioPath);
    
    // Step 4: Extract claim
    const claim = await extractClaim(transcription, caption);
    
    if (claim === 'No verifiable claim found') {
      return {
        success: false,
        message: 'No verifiable claims found in this video to fact-check.'
      };
    }
    
    // Step 5: Search for fact-checks
    const factCheckResults = await searchFactChecks(claim);
    
    // Step 6: Analyze results
    const analysis = analyzeFactChecks(factCheckResults);
    
    // Step 7: Store result
    const resultId = storeFactCheckResult(senderId, claim, {
      transcription,
      caption,
      claim,
      analysis,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      claim,
      transcription,
      analysis,
      resultId
    };
    
  } catch (error) {
    console.error('❌ Error processing Instagram reel:', error);
    throw error;
  } finally {
    // Cleanup temporary files
    if (videoPath || audioPath) {
      await cleanupFiles(videoPath, audioPath);
    }
  }
};

module.exports = {
  processInstagramReel,
  getUserFactCheckHistory,
  storeFactCheckResult,
  downloadVideo,
  extractAudio,
  transcribeAudio,
  extractClaim,
  searchFactChecks,
  analyzeFactChecks
};
