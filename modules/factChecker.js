const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cheerio = require('cheerio');

// Initialize Gemini AI with Pro model for better accuracy
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configurations for different tasks
const MODELS = {
  TRANSCRIPTION: 'gemini-1.5-pro', // Best for audio transcription
  CLAIM_ANALYSIS: 'gemini-1.5-pro', // Best for complex reasoning
  FALLBACK: 'gemini-1.5-flash' // Faster fallback if Pro fails
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
 * Transcribe audio using Gemini AI with enhanced accuracy
 */
const transcribeAudio = async (audioPath) => {
  console.log(`🎤 Transcribing audio: ${audioPath}`);
  
  try {
    // Try with Pro model first, fallback to Flash if needed
    let model;
    let modelName;
    
    try {
      model = genAI.getGenerativeModel({ 
        model: MODELS.TRANSCRIPTION,
        generationConfig: GENERATION_CONFIGS.HIGH_ACCURACY
      });
      modelName = MODELS.TRANSCRIPTION;
    } catch (error) {
      console.log(`⚠️ Fallback to ${MODELS.FALLBACK} model`);
      model = genAI.getGenerativeModel({ 
        model: MODELS.FALLBACK,
        generationConfig: GENERATION_CONFIGS.HIGH_ACCURACY
      });
      modelName = MODELS.FALLBACK;
    }
    
    // Read audio file as buffer
    const audioBuffer = await fs.readFile(audioPath);
    
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
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: 'audio/mp3'
        }
      }
    ]);
    
    const transcription = result.response.text().trim();
    console.log(`✅ Audio transcribed using ${modelName} (${transcription.length} chars): ${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}`);
    
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
 * Extract claim from transcription and caption using Gemini AI
 */
const extractClaim = async (transcription, caption) => {
  console.log(`🧠 Extracting claim from content...`);
  
  try {
    // Try with Pro model first, fallback to Flash if needed
    let model;
    let modelName;
    
    try {
      model = genAI.getGenerativeModel({ 
        model: MODELS.CLAIM_ANALYSIS,
        generationConfig: GENERATION_CONFIGS.BALANCED
      });
      modelName = MODELS.CLAIM_ANALYSIS;
    } catch (error) {
      console.log(`⚠️ Claim analysis fallback to ${MODELS.FALLBACK} model`);
      model = genAI.getGenerativeModel({ 
        model: MODELS.FALLBACK,
        generationConfig: GENERATION_CONFIGS.BALANCED
      });
      modelName = MODELS.FALLBACK;
    }
    
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
    
    const result = await model.generateContent(prompt);
    const claim = result.response.text().trim();
    
    console.log(`✅ Extracted claim using ${modelName}: ${claim}`);
    
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
 * Search for fact-checks using Google Fact Check Tools API with enhanced search strategy
 */
const searchFactChecks = async (claim) => {
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
  
  let allResults = [];
  
  for (const query of uniqueQueries) {
    try {
      const params = {
        query: query.trim(),
        languageCode: 'en',
        maxAgeDays: 30, // Extended to 30 days for better coverage
        pageSize: 10,
        offset: 0,
        key: process.env.GOOGLE_FACTCHECK_API_KEY
      };
      
      console.log(`🔎 Searching with query: "${query}"`);
      const response = await axios.get(baseUrl, { params });
      
      if (response.data.claims && response.data.claims.length > 0) {
        allResults = allResults.concat(response.data.claims);
        console.log(`  ✅ Found ${response.data.claims.length} results`);
      }
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`  ⚠️ Query "${query}" failed:`, error.message);
      continue; // Try next query
    }
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
  
  return { claims: uniqueResults };
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
    const model = genAI.getGenerativeModel({ 
      model: MODELS.CLAIM_ANALYSIS,
      generationConfig: GENERATION_CONFIGS.BALANCED
    });
    
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
    
    const result = await model.generateContent(prompt);
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
 * Analyze fact-check results with LATEST article prioritization and full content analysis
 */
const analyzeFactChecks = async (factCheckResults, originalClaim) => {
  console.log(`📊 Analyzing fact-check results with latest article prioritization...`);
  
  if (!factCheckResults.claims || factCheckResults.claims.length === 0) {
    return {
      verdict: 'Unknown',
      confidence: 'Low',
      summary: 'No fact-check information available for this claim.',
      sources: [],
      latestArticleAnalysis: null
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
    
    const finalWeight = effectiveWeight * confidence;
    totalWeight += finalWeight;
    
    if (normalizedRating === 'false') {
      falseScore += finalWeight;
    } else if (normalizedRating === 'true') {
      trueScore += finalWeight;
    } else if (normalizedRating === 'mixed') {
      mixedScore += finalWeight;
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
  
  const summary = generateLatestFocusedSummary(primaryVerdict, overallConfidence, allSources.length, latestArticleAnalysis, aiInference);
  
  return {
    verdict: primaryVerdict,
    confidence: overallConfidence,
    summary,
    sources: allSources.slice(0, 4), // Top 4 sources (latest first)
    latestArticleAnalysis,
    analysisDetails: {
      totalSources: allSources.length,
      latestSourcePriority: true,
      falseRatio: totalWeight > 0 ? (falseScore / totalWeight).toFixed(2) : '0',
      trueRatio: totalWeight > 0 ? (trueScore / totalWeight).toFixed(2) : '0',
      mixedRatio: totalWeight > 0 ? (mixedScore / totalWeight).toFixed(2) : '0',
      aiInferenceUsed: !!aiInference
    }
  };
};

/**
 * Generate latest-focused summary based on analysis
 */
const generateLatestFocusedSummary = (verdict, confidence, sourceCount, latestArticleAnalysis, aiInference) => {
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
    
    // Step 6: Analyze results (now async with latest article prioritization)
    const analysis = await analyzeFactChecks(factCheckResults, claim);
    
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
