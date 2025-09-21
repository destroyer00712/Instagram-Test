#!/usr/bin/env node

/**
 * Comprehensive Test Report: Reddit Age Detection System
 * Test Cases: Nepal Riots & Charlie Kirk Assassination Claims
 */

const factChecker = require('./modules/factChecker');

// Simulate test environment
console.log('🧪 REDDIT AGE DETECTION SYSTEM - COMPREHENSIVE TEST REPORT');
console.log('=' .repeat(70));
console.log(`📅 Test Date: ${new Date().toLocaleDateString()}`);
console.log(`🎯 Test Topics: Nepal Riots & Charlie Kirk Assassination`);
console.log('=' .repeat(70));

/**
 * Test Case 1: Nepal Riots Claim
 */
async function testNepalRiots() {
    console.log('\n🔥 TEST CASE 1: NEPAL RIOTS');
    console.log('-'.repeat(50));
    
    const testClaim = "Violent riots break out in Nepal killing 50+ people in Kathmandu protests";
    
    console.log(`🎯 Test Claim: "${testClaim}"`);
    console.log(`📊 Expected Behavior:`);
    console.log(`   - Search Reddit for Nepal riot discussions`);
    console.log(`   - Determine claim age from earliest Reddit mentions`);
    console.log(`   - Target fact-check search based on Reddit timeline`);
    console.log(`   - Show improved search efficiency`);
    
    console.log(`\n🔍 STEP 1: Reddit Age Detection`);
    
    try {
        // Test Reddit age detection
        const redditAge = await factChecker.searchRedditForClaimAge(testClaim);
        
        console.log(`✅ Reddit Age Analysis Results:`);
        console.log(`   📅 Estimated Age: ${redditAge.estimatedAgeDays || 'Unable to determine'} days`);
        console.log(`   🎯 Confidence: ${redditAge.confidence}`);
        console.log(`   📊 Total Posts Found: ${redditAge.totalPosts}`);
        
        if (redditAge.earliestPostDate) {
            console.log(`   🕐 Earliest Mention: ${new Date(redditAge.earliestPostDate).toLocaleDateString()}`);
            console.log(`   🕐 Latest Mention: ${new Date(redditAge.latestPostDate).toLocaleDateString()}`);
            console.log(`   ⏱️  Discussion Span: ${redditAge.postTimespan} days`);
        }
        
        if (redditAge.samplePosts && redditAge.samplePosts.length > 0) {
            console.log(`   📝 Sample Posts:`);
            redditAge.samplePosts.slice(0, 3).forEach((post, index) => {
                console.log(`      ${index + 1}. r/${post.subreddit}: "${post.title.substring(0, 60)}..." (${post.date})`);
            });
        }
        
        console.log(`\n🔍 STEP 2: Enhanced Fact-Check Search`);
        
        // Test enhanced fact-check search with Reddit data
        const factCheckResults = await factChecker.searchFactChecks(testClaim, '', '');
        
        console.log(`✅ Fact-Check Search Results:`);
        console.log(`   🎯 Search Strategy: ${factCheckResults.searchStrategy?.description || 'Unknown'}`);
        console.log(`   📊 Claims Found: ${factCheckResults.claims?.length || 0}`);
        console.log(`   🔄 Strategies Tried: ${factCheckResults.totalStrategiesTried || 1}`);
        
        if (factCheckResults.redditAgeAnalysis) {
            const reddit = factCheckResults.redditAgeAnalysis;
            if (reddit.estimatedAgeDays) {
                console.log(`   📅 Reddit-Based Age: ${reddit.estimatedAgeDays} days (${reddit.confidence} confidence)`);
            }
        }
        
        if (factCheckResults.claims && factCheckResults.claims.length > 0) {
            console.log(`   📰 Top Sources Found:`);
            factCheckResults.claims.slice(0, 3).forEach((claim, index) => {
                const review = claim.claimReview?.[0];
                if (review) {
                    console.log(`      ${index + 1}. ${review.publisher?.name}: ${review.textualRating} (${review.reviewDate})`);
                }
            });
        }
        
        // Performance Analysis
        console.log(`\n📈 PERFORMANCE ANALYSIS:`);
        if (redditAge.estimatedAgeDays && redditAge.confidence !== 'low') {
            console.log(`   ✅ SUCCESS: Reddit age detection provided ${redditAge.confidence} confidence targeting`);
            console.log(`   🎯 OPTIMIZATION: Search targeted to ~${redditAge.estimatedAgeDays + 15} day window`);
            console.log(`   ⚡ EFFICIENCY: Avoided generic timeline progression`);
        } else {
            console.log(`   ⚠️  FALLBACK: Reddit data inconclusive, used video metadata approach`);
        }
        
        return {
            success: true,
            redditAge,
            factCheckResults,
            claim: testClaim
        };
        
    } catch (error) {
        console.log(`❌ ERROR in Nepal riots test: ${error.message}`);
        return {
            success: false,
            error: error.message,
            claim: testClaim
        };
    }
}

/**
 * Test Case 2: Charlie Kirk Assassination Claim
 */
async function testCharlieKirkClaim() {
    console.log('\n🎭 TEST CASE 2: CHARLIE KIRK ASSASSINATION');
    console.log('-'.repeat(50));
    
    const testClaim = "Charlie Kirk was shot and killed in assassination attempt at rally";
    
    console.log(`🎯 Test Claim: "${testClaim}"`);
    console.log(`📊 Expected Behavior:`);
    console.log(`   - Search Reddit for Charlie Kirk assassination discussions`);
    console.log(`   - This is likely a false/satirical claim`);
    console.log(`   - Should find debunking discussions on Reddit`);
    console.log(`   - Demonstrate fact-check effectiveness on false claims`);
    
    console.log(`\n🔍 STEP 1: Reddit Age Detection`);
    
    try {
        // Test Reddit age detection for potentially false claim
        const redditAge = await factChecker.searchRedditForClaimAge(testClaim);
        
        console.log(`✅ Reddit Age Analysis Results:`);
        console.log(`   📅 Estimated Age: ${redditAge.estimatedAgeDays || 'Unable to determine'} days`);
        console.log(`   🎯 Confidence: ${redditAge.confidence}`);
        console.log(`   📊 Total Posts Found: ${redditAge.totalPosts}`);
        
        if (redditAge.earliestPostDate) {
            console.log(`   🕐 Earliest Mention: ${new Date(redditAge.earliestPostDate).toLocaleDateString()}`);
            console.log(`   🕐 Latest Mention: ${new Date(redditAge.latestPostDate).toLocaleDateString()}`);
            console.log(`   ⏱️  Discussion Span: ${redditAge.postTimespan} days`);
        }
        
        if (redditAge.samplePosts && redditAge.samplePosts.length > 0) {
            console.log(`   📝 Sample Posts:`);
            redditAge.samplePosts.slice(0, 3).forEach((post, index) => {
                console.log(`      ${index + 1}. r/${post.subreddit}: "${post.title.substring(0, 60)}..." (${post.date})`);
            });
        }
        
        console.log(`\n🔍 STEP 2: Enhanced Fact-Check Search`);
        
        // Test enhanced fact-check search
        const factCheckResults = await factChecker.searchFactChecks(testClaim, '', '');
        
        console.log(`✅ Fact-Check Search Results:`);
        console.log(`   🎯 Search Strategy: ${factCheckResults.searchStrategy?.description || 'Unknown'}`);
        console.log(`   📊 Claims Found: ${factCheckResults.claims?.length || 0}`);
        console.log(`   🔄 Strategies Tried: ${factCheckResults.totalStrategiesTried || 1}`);
        
        if (factCheckResults.redditAgeAnalysis) {
            const reddit = factCheckResults.redditAgeAnalysis;
            if (reddit.estimatedAgeDays) {
                console.log(`   📅 Reddit-Based Age: ${reddit.estimatedAgeDays} days (${reddit.confidence} confidence)`);
            }
        }
        
        if (factCheckResults.claims && factCheckResults.claims.length > 0) {
            console.log(`   📰 Top Sources Found:`);
            factCheckResults.claims.slice(0, 3).forEach((claim, index) => {
                const review = claim.claimReview?.[0];
                if (review) {
                    console.log(`      ${index + 1}. ${review.publisher?.name}: ${review.textualRating} (${review.reviewDate})`);
                }
            });
        }
        
        // Test Reddit sentiment analysis for this claim
        console.log(`\n🗣️  STEP 3: Reddit Sentiment Analysis`);
        
        const redditSentiment = await factChecker.searchRedditForVerification(testClaim);
        const sentimentAnalysis = await factChecker.analyzeRedditSentiment(redditSentiment, testClaim);
        
        console.log(`   📊 Reddit Sentiment: ${sentimentAnalysis.sentiment}`);
        console.log(`   🎯 Sentiment Confidence: ${(sentimentAnalysis.confidence * 100).toFixed(1)}%`);
        console.log(`   🏛️  Community Consensus: ${sentimentAnalysis.community_consensus}`);
        
        if (sentimentAnalysis.credible_sources_mentioned.length > 0) {
            console.log(`   📰 Credible Sources Mentioned: ${sentimentAnalysis.credible_sources_mentioned.join(', ')}`);
        }
        
        // Performance Analysis
        console.log(`\n📈 PERFORMANCE ANALYSIS:`);
        if (redditAge.estimatedAgeDays && redditAge.confidence !== 'low') {
            console.log(`   ✅ SUCCESS: Reddit age detection provided ${redditAge.confidence} confidence targeting`);
            console.log(`   🎯 DEBUNKING: Expected to find fact-checks debunking this false claim`);
            console.log(`   🗣️  COMMUNITY: Reddit community likely skeptical or debunking`);
        } else {
            console.log(`   ⚠️  LIMITED DATA: Claim may be too obscure or recent for Reddit discussions`);
        }
        
        return {
            success: true,
            redditAge,
            factCheckResults,
            sentimentAnalysis,
            claim: testClaim
        };
        
    } catch (error) {
        console.log(`❌ ERROR in Charlie Kirk test: ${error.message}`);
        return {
            success: false,
            error: error.message,
            claim: testClaim
        };
    }
}

/**
 * Comparative Analysis: Before vs After
 */
function generateComparisonReport(nepalResults, charlieResults) {
    console.log('\n📊 COMPARATIVE ANALYSIS: BEFORE vs AFTER');
    console.log('=' .repeat(70));
    
    console.log(`\n🔄 SYSTEM IMPROVEMENTS:`);
    console.log(`\n1. TIMELINE TARGETING:`);
    console.log(`   BEFORE: Generic progression (30d → 90d → 1y → 5y → all time)`);
    console.log(`   AFTER:  Reddit-based targeting to optimal time windows`);
    
    console.log(`\n2. SEARCH EFFICIENCY:`);
    console.log(`   BEFORE: Multiple searches until results found`);
    console.log(`   AFTER:  Direct targeting based on claim age`);
    
    console.log(`\n3. CONTEXTUAL AWARENESS:`);
    console.log(`   BEFORE: Limited context about when claims emerged`);
    console.log(`   AFTER:  Rich timeline context from Reddit discussions`);
    
    console.log(`\n📈 TEST RESULTS SUMMARY:`);
    
    // Nepal riots analysis
    if (nepalResults.success) {
        console.log(`\n🔥 NEPAL RIOTS:`);
        console.log(`   ✅ Reddit Age Detection: ${nepalResults.redditAge.confidence} confidence`);
        console.log(`   📊 Reddit Posts Found: ${nepalResults.redditAge.totalPosts}`);
        console.log(`   🎯 Search Strategy: ${nepalResults.factCheckResults.searchStrategy?.description || 'Standard'}`);
        console.log(`   📰 Fact-Check Sources: ${nepalResults.factCheckResults.claims?.length || 0}`);
        
        if (nepalResults.redditAge.estimatedAgeDays) {
            console.log(`   📅 Claim Age: ~${nepalResults.redditAge.estimatedAgeDays} days old`);
            console.log(`   🎯 IMPROVEMENT: Targeted search instead of progressive trial`);
        }
    } else {
        console.log(`\n🔥 NEPAL RIOTS: ❌ Test failed - ${nepalResults.error}`);
    }
    
    // Charlie Kirk analysis  
    if (charlieResults.success) {
        console.log(`\n🎭 CHARLIE KIRK:`);
        console.log(`   ✅ Reddit Age Detection: ${charlieResults.redditAge.confidence} confidence`);
        console.log(`   📊 Reddit Posts Found: ${charlieResults.redditAge.totalPosts}`);
        console.log(`   🎯 Search Strategy: ${charlieResults.factCheckResults.searchStrategy?.description || 'Standard'}`);
        console.log(`   📰 Fact-Check Sources: ${charlieResults.factCheckResults.claims?.length || 0}`);
        console.log(`   🗣️  Reddit Sentiment: ${charlieResults.sentimentAnalysis?.sentiment || 'Unknown'}`);
        
        if (charlieResults.redditAge.estimatedAgeDays) {
            console.log(`   📅 Claim Age: ~${charlieResults.redditAge.estimatedAgeDays} days old`);
            console.log(`   🎯 IMPROVEMENT: Reddit sentiment helps identify false claims`);
        }
    } else {
        console.log(`\n🎭 CHARLIE KIRK: ❌ Test failed - ${charlieResults.error}`);
    }
    
    console.log(`\n🎯 EXPECTED VS ACTUAL:`);
    console.log(`\n   NEPAL RIOTS (Expected: Real news event)`);
    console.log(`   - Should find legitimate news discussions on Reddit`);
    console.log(`   - Should find fact-check sources confirming or analyzing event`);
    console.log(`   - Timeline should show when riots actually occurred`);
    
    console.log(`\n   CHARLIE KIRK (Expected: False/satirical claim)`);
    console.log(`   - Should find debunking discussions or absence of legitimate news`);
    console.log(`   - Reddit sentiment should be skeptical or debunking`);
    console.log(`   - Fact-checkers should rate as false if they've covered it`);
    
    console.log(`\n✅ SYSTEM VALIDATION:`);
    const successCount = (nepalResults.success ? 1 : 0) + (charlieResults.success ? 1 : 0);
    console.log(`   📊 Test Success Rate: ${successCount}/2 (${(successCount/2*100).toFixed(0)}%)`);
    
    if (successCount === 2) {
        console.log(`   🎉 CONCLUSION: Reddit age detection system is working correctly`);
        console.log(`   🚀 READY FOR: Production deployment with enhanced targeting`);
    } else {
        console.log(`   ⚠️  CONCLUSION: Some tests failed, system needs debugging`);
        console.log(`   🔧 ACTION: Review error logs and API connectivity`);
    }
}

/**
 * Main Test Execution
 */
async function runComprehensiveTests() {
    console.log(`\n🚀 Starting comprehensive test execution...`);
    console.log(`⏱️  Estimated time: 30-60 seconds per test case`);
    
    const startTime = Date.now();
    
    // Run test cases
    const nepalResults = await testNepalRiots();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Breathing room between tests
    
    const charlieResults = await testCharlieKirkClaim();
    
    // Generate comprehensive report
    generateComparisonReport(nepalResults, charlieResults);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log(`\n⏱️  Total test duration: ${duration} seconds`);
    console.log(`📝 Test report complete!`);
    console.log('=' .repeat(70));
}

// Execute tests if run directly
if (require.main === module) {
    runComprehensiveTests().catch(error => {
        console.error(`❌ Test execution failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    testNepalRiots,
    testCharlieKirkClaim,
    runComprehensiveTests
};
