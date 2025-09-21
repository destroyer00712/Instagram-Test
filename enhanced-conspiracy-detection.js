/**
 * ENHANCED: Create smart search queries focused on debunking known false claims
 */
const createSmartSearchQueries = async (claim, caption = '', transcription = '') => {
  console.log(`🧠 Creating smart search queries with enhanced conspiracy detection...`);
  
  const lowerClaim = claim.toLowerCase();
  
  // ENHANCED: Detect known false claims and conspiracy theories
  const knownFalseClaims = [
    { 
      keywords: ['vaccine', 'microchip', 'chip', '5g'], 
      queries: [
        '"COVID vaccine microchip" debunked fact check snopes reuters',
        '"vaccine contains microchip" false claim AFP factcheck',
        'COVID vaccine conspiracy theory debunked WHO CDC'
      ],
      type: 'vaccine conspiracy'
    },
    { 
      keywords: ['moon landing', 'filmed', 'fake', 'studio', 'hoax'], 
      queries: [
        '"moon landing hoax" debunked NASA evidence proof',
        '"moon landing fake" conspiracy theory mythbusters debunked',
        'Apollo moon landing evidence real proof scientific'
      ],
      type: 'moon landing conspiracy'
    },
    { 
      keywords: ['elon musk', 'bought', 'cnn', 'billion'], 
      queries: [
        '"Elon Musk bought CNN" fake news debunked snopes',
        '"Elon Musk CNN acquisition" false claim hoax',
        'Elon Musk CNN purchase fake news fact check'
      ],
      type: 'business hoax'
    },
    { 
      keywords: ['flat earth'], 
      queries: [
        '"flat earth" debunked scientific evidence NASA',
        'flat earth conspiracy theory debunked proof round',
        'earth is round scientific evidence debunked flat'
      ],
      type: 'flat earth conspiracy'
    }
  ];
  
  // Check if this matches known false claims
  for (const falseClaimPattern of knownFalseClaims) {
    const matchCount = falseClaimPattern.keywords.filter(keyword => 
      lowerClaim.includes(keyword.toLowerCase())
    ).length;
    
    if (matchCount >= 2) { // At least 2 keywords match
      console.log(`🎯 DETECTED ${falseClaimPattern.type.toUpperCase()}: Using specialized debunking queries`);
      console.log(`📝 Matched ${matchCount}/${falseClaimPattern.keywords.length} keywords: ${falseClaimPattern.keywords.filter(k => lowerClaim.includes(k)).join(', ')}`);
      
      return falseClaimPattern.queries.map(query => ({ query }));
    }
  }
  
  // For unknown claims, use AI to generate debunking-focused queries
  try {
    const contextPrompt = `Generate 3 Google search queries to find FACT-CHECKING and DEBUNKING articles about this claim.

CLAIM: "${claim}"

REQUIREMENTS:
1. **PRIORITIZE DEBUNKING** - focus on queries that will find fact-checking articles
2. **Include fact-check terms** - use words like "debunked", "fact check", "false", "hoax", "conspiracy"
3. **Target authoritative sources** - news outlets, fact-checkers, scientific organizations
4. **Use exact phrases** from the claim in quotes for precision

Return as JSON: [{"query": "search query 1"}, {"query": "search query 2"}, {"query": "search query 3"}]`;

    const { result } = await makeGeminiAPICall(
      MODELS.CLAIM_ANALYSIS,
      GENERATION_CONFIGS.HIGH_ACCURACY,
      contextPrompt
    );

    const response = result.response.text().trim();
    const queries = JSON.parse(response);
    
    if (Array.isArray(queries) && queries.length > 0) {
      console.log(`✅ Created ${queries.length} AI-generated debunking queries`);
      return queries.slice(0, 3);
    }
    
  } catch (error) {
    console.log(`⚠️ AI query generation failed: ${error.message}`);
  }
  
  // Enhanced fallback with debunking focus
  const fallbackQueries = [
    `"${claim}" debunked fact check`,
    `"${claim}" false claim hoax`,
    `${claim} conspiracy theory debunked`
  ];
  
  console.log(`📝 Using ${fallbackQueries.length} enhanced fallback queries`);
  return fallbackQueries.map(query => ({ query }));
};

/**
 * COMPLETELY REWRITTEN: Analyze Google Custom Search results properly
 */
const analyzeFactChecks = async (factCheckResults, originalClaim, videoAnalysis = null) => {
  console.log(`📊 ENHANCED ANALYSIS: Processing Google Custom Search results only...`);
  
  // Skip all Reddit and traditional fact-check processing
  console.log(`🚀 Using ONLY Google Custom Search + AI analysis (as requested)`);
  
  // Check if we have Google Custom Search results
  if (!factCheckResults || factCheckResults.length === 0) {
    console.log(`⚠️ No Google Custom Search results to analyze`);
    return {
      verdict: 'Unknown',
      confidence: 'Low',
      summary: 'No relevant articles found to verify this claim.',
      sources: []
    };
  }
  
  console.log(`✅ Analyzing ${factCheckResults.length} Google Custom Search results with AI analysis`);
  
  // Count AI verdicts
  let trueCount = 0;
  let falseCount = 0;
  let mixedCount = 0;
  let unclearCount = 0;
  let highConfidenceCount = 0;
  let totalConfidenceScore = 0;
  
  const validSources = [];
  
  factCheckResults.forEach((result, i) => {
    const aiVerdict = result.aiAnalysis?.verdict?.toUpperCase() || 'UNCLEAR';
    const aiConfidence = result.aiAnalysis?.confidence?.toUpperCase() || 'LOW';
    
    console.log(`  📰 ${i + 1}. ${result.publisher}: AI verdict = ${aiVerdict} (${aiConfidence})`);
    
    // Count verdicts
    switch (aiVerdict) {
      case 'TRUE':
        trueCount++;
        break;
      case 'FALSE':
        falseCount++;
        break;
      case 'MIXED':
        mixedCount++;
        break;
      default:
        unclearCount++;
    }
    
    // Calculate confidence scores
    let confidenceScore = 0.3; // Base score
    if (aiConfidence === 'HIGH') {
      highConfidenceCount++;
      confidenceScore = 0.95;
    } else if (aiConfidence === 'MEDIUM') {
      confidenceScore = 0.75;
    }
    
    totalConfidenceScore += confidenceScore;
    
    if (aiVerdict !== 'UNCLEAR') {
      validSources.push({
        publisher: result.publisher,
        verdict: aiVerdict,
        confidence: aiConfidence,
        url: result.url
      });
    }
  });
  
  const avgConfidence = factCheckResults.length > 0 ? totalConfidenceScore / factCheckResults.length : 0;
  
  console.log(`📊 VERDICT SUMMARY:`);
  console.log(`   🔴 FALSE: ${falseCount} sources`);
  console.log(`   🟢 TRUE: ${trueCount} sources`);
  console.log(`   🟡 MIXED: ${mixedCount} sources`);
  console.log(`   ⚪ UNCLEAR: ${unclearCount} sources`);
  console.log(`   💪 HIGH CONFIDENCE: ${highConfidenceCount}/${factCheckResults.length} sources`);
  console.log(`   📊 AVERAGE CONFIDENCE: ${(avgConfidence * 100).toFixed(1)}%`);
  
  // ENHANCED DECISION LOGIC: Prioritize FALSE findings for conspiracy theories
  let finalVerdict = 'Unknown';
  let finalConfidence = 'Low';
  
  if (falseCount > 0) {
    // If ANY source says FALSE, lean toward FALSE (important for conspiracy theories)
    finalVerdict = 'False';
    if (highConfidenceCount > 0) {
      finalConfidence = 'High';
    } else if (avgConfidence > 0.6) {
      finalConfidence = 'Medium';
    } else {
      finalConfidence = 'Low';
    }
    console.log(`🎯 VERDICT: FALSE detected by ${falseCount} source(s) - treating as FALSE`);
    
  } else if (trueCount > falseCount && trueCount > 0) {
    finalVerdict = 'True';
    finalConfidence = highConfidenceCount > 0 ? 'High' : (avgConfidence > 0.6 ? 'Medium' : 'Low');
    console.log(`🎯 VERDICT: TRUE confirmed by ${trueCount} source(s)`);
    
  } else if (mixedCount > 0) {
    finalVerdict = 'Mixed';
    finalConfidence = 'Medium';
    console.log(`🎯 VERDICT: MIXED evidence from ${mixedCount} source(s)`);
  } else {
    console.log(`🎯 VERDICT: UNKNOWN - no clear evidence found`);
  }
  
  // Generate enhanced summary
  let summary = `Based on AI analysis of ${factCheckResults.length} Google Custom Search article${factCheckResults.length !== 1 ? 's' : ''}, `;
  
  switch (finalVerdict) {
    case 'False':
      summary += `**this claim is FALSE**. `;
      if (falseCount > 1) {
        summary += `${falseCount} sources contradict this claim.`;
      } else {
        summary += `Evidence contradicts this claim.`;
      }
      break;
    case 'True':
      summary += `**this claim is TRUE**. `;
      if (trueCount > 1) {
        summary += `${trueCount} sources confirm this claim.`;
      } else {
        summary += `Evidence supports this claim.`;
      }
      break;
    case 'Mixed':
      summary += `**this claim is PARTIALLY TRUE** with some misleading elements.`;
      break;
    default:
      summary += `**insufficient evidence** to determine the accuracy of this claim.`;
  }
  
  if (highConfidenceCount > 0) {
    summary += ` Analysis includes ${highConfidenceCount} high-confidence source${highConfidenceCount !== 1 ? 's' : ''}.`;
  }
  
  console.log(`🏁 FINAL RESULT: ${finalVerdict} (${finalConfidence} confidence)`);
  console.log(`📝 Summary: ${summary}`);
  
  return {
    verdict: finalVerdict,
    confidence: finalConfidence,
    summary: summary,
    sources: validSources,
    totalSources: factCheckResults.length,
    googleSearchSummary: summary
  };
};

module.exports = {
  createSmartSearchQueries,
  analyzeFactChecks
};
