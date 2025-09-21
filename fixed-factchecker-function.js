/**
 * Search for fact-checks using ONLY Google Custom Search + AI Analysis
 * COMPLETELY BYPASSES fact-check APIs as requested
 */
const searchFactChecks = async (claim, videoUrl = '', caption = '', transcription = '') => {
  console.log(`🔍 FACT-CHECKING USING ONLY GOOGLE CUSTOM SEARCH: ${claim}`);
  
  // STEP 1: Use Google Custom Search to find articles about the claim
  console.log(`🔍 Step 1: Finding articles with Google Custom Search...`);
  const googleAgeAnalysis = await searchGoogleForClaimAge(claim, videoUrl, caption, transcription);
  
  // STEP 2: Convert Google Custom Search results directly to fact-check format
  let allResults = [];
  
  console.log(`🔍 Step 2: Converting Google Custom Search articles to fact-check results...`);
  
  if (googleAgeAnalysis && googleAgeAnalysis.articlesWithContent && googleAgeAnalysis.articlesWithContent.length > 0) {
    console.log(`✅ Found ${googleAgeAnalysis.articlesWithContent.length} Google Custom Search articles with AI analysis`);
    
    // Convert Google search results with AI analysis to fact-check format  
    allResults = googleAgeAnalysis.articlesWithContent.map((article, index) => ({
      claim: claim,
      publisher: article.source || 'Google Search',
      url: article.url || `https://example.com/google-article-${index}`,
      rating: mapAIVerdictToRating(article.claimVerdict),
      date: article.eventDate ? article.eventDate.toISOString() : new Date().toISOString(),
      title: article.title || `Article ${index + 1} about: ${claim.substring(0, 50)}...`,
      snippet: article.content ? article.content.substring(0, 200) + '...' : '',
      sourceType: 'google_search',
      aiAnalysis: {
        verdict: article.claimVerdict || 'UNCLEAR',
        confidence: article.confidence || 'MEDIUM'
      },
      googleAgeAnalysis: googleAgeAnalysis
    }));
    
    console.log(`✅ Converted ${allResults.length} Google articles to fact-check format`);
    
    // Show sample results
    if (allResults.length > 0) {
      console.log('\n📊 Sample Google Custom Search Results:');
      allResults.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.publisher}: ${result.rating}`);
        console.log(`     AI Verdict: ${result.aiAnalysis?.verdict || 'UNCLEAR'}`);
        console.log(`     "${result.title}"`);
        console.log(`     ${result.url}`);
      });
      console.log('');
    }
    
  } else {
    console.log(`⚠️ No Google Custom Search articles found - cannot fact-check this claim`);
  }

  console.log(`✅ Total unique results found: ${allResults.length}`);
  return allResults;
};

/**
 * Map AI verdict to traditional fact-check rating
 */
const mapAIVerdictToRating = (verdict) => {
  switch(verdict?.toUpperCase()) {
    case 'TRUE': return 'True';
    case 'FALSE': return 'False';
    case 'MIXED': return 'Mixed';
    case 'UNCLEAR': return 'Unrated';
    default: return 'Unrated';
  }
};
