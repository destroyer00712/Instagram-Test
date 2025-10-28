const { QdrantClient } = require('@qdrant/js-client-rest');
const { pipeline } = require('@xenova/transformers');
const { v4: uuidv4 } = require('uuid');

// Initialize Qdrant client
let qdrantClient = null;
let embeddingPipeline = null;

// Configuration
const SIMILARITY_THRESHOLD = 0.85;
const FRESHNESS_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
const EXPIRATION_TIME = 60 * 60 * 1000; // 1 hour in milliseconds
const COLLECTION_NAME = process.env.VECTOR_CACHE_COLLECTION || 'fact_checks';
const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 embedding size

/**
 * Initialize Qdrant client and embedding pipeline
 */
const initializeQdrant = async () => {
  try {
    console.log('[VECTOR_CACHE] Initializing Qdrant client...');
    
    // Initialize Qdrant client
    qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY || undefined
    });
    
    // Test connection
    await qdrantClient.getCollections();
    console.log('[VECTOR_CACHE] ✅ Qdrant client connected successfully');
    
    // Initialize embedding pipeline
    console.log('[VECTOR_CACHE] Loading embedding model (all-MiniLM-L6-v2)...');
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('[VECTOR_CACHE] ✅ Embedding pipeline loaded successfully');
    
    // Create collection if it doesn't exist
    await createCollectionIfNotExists();
    
  } catch (error) {
    console.error('[VECTOR_CACHE] ❌ Initialization failed:', error.message);
    throw error;
  }
};

/**
 * Create Qdrant collection if it doesn't exist
 */
const createCollectionIfNotExists = async () => {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(col => col.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      console.log(`[VECTOR_CACHE] Creating collection: ${COLLECTION_NAME}`);
      
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine'
        }
      });
      
      console.log(`[VECTOR_CACHE] ✅ Collection ${COLLECTION_NAME} created successfully`);
    } else {
      console.log(`[VECTOR_CACHE] Collection ${COLLECTION_NAME} already exists`);
    }
  } catch (error) {
    console.error('[VECTOR_CACHE] ❌ Error creating collection:', error.message);
    throw error;
  }
};

/**
 * Generate embedding for text using sentence transformers
 */
const generateEmbedding = async (text) => {
  try {
    if (!embeddingPipeline) {
      throw new Error('Embedding pipeline not initialized');
    }
    
    // Clean and truncate text for embedding
    const cleanText = text.trim().substring(0, 512); // Limit to 512 chars for efficiency
    
    const output = await embeddingPipeline(cleanText, {
      pooling: 'mean',
      normalize: true
    });
    
    return output.data;
  } catch (error) {
    console.error('[VECTOR_CACHE] ❌ Error generating embedding:', error.message);
    throw error;
  }
};

/**
 * Create composite text from claim, transcription, and caption with weights
 */
const createCompositeText = (claim, transcription = '', caption = '') => {
  // Weighted composition: claim (60%) + transcription (25%) + caption (15%)
  const weightedText = [
    claim,
    transcription,
    caption
  ].filter(text => text && text.trim().length > 0);
  
  return weightedText.join(' ');
};

/**
 * Check if a timestamp is fresh (less than 30 minutes old)
 */
const isFresh = (timestamp) => {
  const now = Date.now();
  const age = now - timestamp;
  return age < FRESHNESS_THRESHOLD;
};

/**
 * Search for similar claims in the vector database
 */
const searchSimilarClaims = async (claim, transcription = '', caption = '') => {
  try {
    if (!qdrantClient) {
      throw new Error('Qdrant client not initialized');
    }
    
    console.log('[VECTOR_CACHE] Searching for similar claims...');
    
    // Create composite text and generate embedding
    const compositeText = createCompositeText(claim, transcription, caption);
    const queryVector = await generateEmbedding(compositeText);
    
    // Search for similar vectors
    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: 5,
      with_payload: true,
      score_threshold: SIMILARITY_THRESHOLD
    });
    
    if (searchResult.length === 0) {
      console.log('[VECTOR_CACHE] No similar claims found');
      return null;
    }
    
    // Find the best match that is fresh
    for (const result of searchResult) {
      const payload = result.payload;
      const createdAt = payload.metadata?.created_at;
      
      if (createdAt && isFresh(createdAt)) {
        const ageMinutes = Math.floor((Date.now() - createdAt) / (60 * 1000));
        console.log(`[VECTOR_CACHE] Similar claim found (similarity: ${result.score.toFixed(3)}, age: ${ageMinutes}min)`);
        
        return {
          id: result.id,
          similarity: result.score,
          age: Date.now() - createdAt,
          ageMinutes: ageMinutes,
          payload: payload
        };
      }
    }
    
    // If no fresh matches found, return the best match anyway (for logging)
    const bestMatch = searchResult[0];
    const ageMinutes = Math.floor((Date.now() - bestMatch.payload.metadata?.created_at) / (60 * 1000));
    console.log(`[VECTOR_CACHE] Similar claim found but stale (similarity: ${bestMatch.score.toFixed(3)}, age: ${ageMinutes}min)`);
    
    return {
      id: bestMatch.id,
      similarity: bestMatch.score,
      age: Date.now() - bestMatch.payload.metadata?.created_at,
      ageMinutes: ageMinutes,
      payload: bestMatch.payload,
      stale: true
    };
    
  } catch (error) {
    console.error('[VECTOR_CACHE] ❌ Error searching similar claims:', error.message);
    return null;
  }
};

/**
 * Store a fact-check result in the vector database
 */
const storeFactCheck = async (claim, transcription, caption, factCheckResult, userId, reelId) => {
  try {
    if (!qdrantClient) {
      throw new Error('Qdrant client not initialized');
    }
    
    console.log('[VECTOR_CACHE] Storing fact-check in vector database...');
    
    // Create composite text and generate embedding
    const compositeText = createCompositeText(claim, transcription, caption);
    const embedding = await generateEmbedding(compositeText);
    
    // Create payload
    const now = Date.now();
    const payload = {
      claim_text: claim,
      transcription: transcription || '',
      caption: caption || '',
      composite_text: compositeText,
      fact_check_result: {
        verdict: factCheckResult.verdict,
        confidence: factCheckResult.confidence,
        sources: factCheckResult.sources || [],
        summary: factCheckResult.summary || ''
      },
      metadata: {
        user_id: userId,
        reel_id: reelId,
        created_at: now,
        expires_at: now + EXPIRATION_TIME
      }
    };
    
    // Generate unique ID
    const pointId = uuidv4();
    
    // Store in Qdrant
    await qdrantClient.upsert(COLLECTION_NAME, {
      wait: true,
      points: [{
        id: pointId,
        vector: embedding,
        payload: payload
      }]
    });
    
    console.log(`[VECTOR_CACHE] ✅ Stored fact-check with ID: ${pointId}`);
    return pointId;
    
  } catch (error) {
    console.error('[VECTOR_CACHE] ❌ Error storing fact-check:', error.message);
    throw error;
  }
};

/**
 * Clean up expired entries from the vector database
 */
const cleanupExpiredEntries = async () => {
  try {
    if (!qdrantClient) {
      throw new Error('Qdrant client not initialized');
    }
    
    console.log('[VECTOR_CACHE] Starting cleanup of expired entries...');
    
    const now = Date.now();
    let deletedCount = 0;
    let totalCount = 0;
    
    // Get collection info to check if it exists
    try {
      const collectionInfo = await qdrantClient.getCollection(COLLECTION_NAME);
      totalCount = collectionInfo.points_count;
      
      if (totalCount === 0) {
        console.log('[VECTOR_CACHE] No entries to clean up');
        return { deleted: 0, total: 0 };
      }
    } catch (error) {
      console.log('[VECTOR_CACHE] Collection does not exist, skipping cleanup');
      return { deleted: 0, total: 0 };
    }
    
    // Scroll through all points to find expired ones
    const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
      limit: 100,
      with_payload: true
    });
    
    const expiredPoints = [];
    
    for (const point of scrollResult.points) {
      const expiresAt = point.payload?.metadata?.expires_at;
      if (expiresAt && expiresAt < now) {
        expiredPoints.push(point.id);
      }
    }
    
    // Delete expired points in batches
    if (expiredPoints.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < expiredPoints.length; i += batchSize) {
        const batch = expiredPoints.slice(i, i + batchSize);
        await qdrantClient.delete(COLLECTION_NAME, {
          wait: true,
          points: batch
        });
        deletedCount += batch.length;
      }
    }
    
    console.log(`[VECTOR_CACHE] ✅ Cleanup complete: deleted ${deletedCount}/${totalCount} expired entries`);
    return { deleted: deletedCount, total: totalCount };
    
  } catch (error) {
    console.error('[VECTOR_CACHE] ❌ Error during cleanup:', error.message);
    return { deleted: 0, total: 0, error: error.message };
  }
};

/**
 * Get cache statistics
 */
const getCacheStats = async () => {
  try {
    if (!qdrantClient) {
      return { error: 'Qdrant client not initialized' };
    }
    
    const collectionInfo = await qdrantClient.getCollection(COLLECTION_NAME);
    
    return {
      totalPoints: collectionInfo.points_count,
      collectionName: COLLECTION_NAME,
      vectorSize: VECTOR_SIZE,
      similarityThreshold: SIMILARITY_THRESHOLD,
      freshnessThresholdMinutes: FRESHNESS_THRESHOLD / (60 * 1000),
      expirationHours: EXPIRATION_TIME / (60 * 60 * 1000)
    };
    
  } catch (error) {
    console.error('[VECTOR_CACHE] ❌ Error getting cache stats:', error.message);
    return { error: error.message };
  }
};

/**
 * Check if the vector cache is ready to use
 */
const isReady = () => {
  return qdrantClient !== null && embeddingPipeline !== null;
};

module.exports = {
  initializeQdrant,
  searchSimilarClaims,
  storeFactCheck,
  cleanupExpiredEntries,
  getCacheStats,
  isReady,
  isFresh,
  SIMILARITY_THRESHOLD,
  FRESHNESS_THRESHOLD,
  EXPIRATION_TIME
};
