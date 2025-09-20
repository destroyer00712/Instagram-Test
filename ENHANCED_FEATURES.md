# Enhanced Fact-Checker Features 🚀

## Overview

The Instagram Fact-Checker has been significantly enhanced with advanced AI capabilities, visual analysis, logical consistency checking, and Reddit integration. This document outlines all the new features and improvements.

## 🆕 New Features

### 1. Video Frame Analysis 🖼️
- **Purpose**: Replaces simple audio summaries with comprehensive visual descriptions
- **Implementation**: Extracts 5 key frames from videos and analyzes them using Gemini AI
- **Benefits**: 
  - Provides visual context for accessibility (audio descriptions)
  - Detects visual inconsistencies and manipulation
  - Identifies text overlays, graphics, and credibility indicators
  - Assesses production quality and authenticity

**Function**: `analyzeVideoFrames(framePaths, transcription)`

### 2. Logical Consistency Checker 🧠
- **Purpose**: Detects contradictions and logical fallacies in claims and evidence
- **Implementation**: AI-powered analysis that compares claims against visual evidence and fact-check results
- **Scoring**: Provides consistency scores (0.0-1.0) and weight adjustments (-0.3 to +0.3)
- **Benefits**:
  - Identifies internal contradictions in claims
  - Detects when visuals don't support audio claims
  - Flags logical fallacies and manipulation attempts
  - Adjusts final verdict based on logical consistency

**Function**: `checkLogicalConsistency(claim, videoAnalysis, factCheckResults)`

### 3. Reddit Integration 🔄
- **Purpose**: Provides community-based verification when Google Fact Checker fails
- **Implementation**: 
  - Searches relevant subreddits (news, worldnews, politics, factcheck, skeptic, etc.)
  - Analyzes community sentiment and verification signals
  - Uses upvote ratios and comment counts for credibility scoring
- **Benefits**:
  - Fallback verification when professional fact-checkers haven't covered a claim
  - Community-driven insights and verification
  - Real-time public sentiment analysis

**Functions**: 
- `searchRedditForVerification(claim)`
- `analyzeRedditSentiment(redditResults, originalClaim)`

### 4. Enhanced Context & Audio Descriptions 📝
- **Purpose**: Provides comprehensive video descriptions instead of just audio summaries
- **Implementation**: Combines visual analysis with audio transcription
- **Benefits**:
  - Better accessibility for visually impaired users
  - More complete context for fact-checking decisions
  - Identifies visual elements that support or contradict claims

### 5. Weighted Scoring System ⚖️
- **Purpose**: Incorporates multiple factors into final verdict calculation
- **Implementation**: 
  - Latest articles get 3x weight (recency bias)
  - Logical consistency adjustments (-0.3 to +0.3)
  - Reddit sentiment weighting when used as fallback
  - Publisher credibility scores
- **Benefits**:
  - More nuanced and accurate verdicts
  - Accounts for logical inconsistencies
  - Prioritizes recent and credible sources

## 🔧 Technical Improvements

### Enhanced Processing Pipeline
The main processing function now follows this enhanced pipeline:

1. **Download Video** - Same as before
2. **Parallel Extraction** - Extract audio and video frames simultaneously
3. **Audio Transcription** - Same as before
4. **Video Analysis** - NEW: Analyze visual content
5. **Claim Extraction** - Enhanced with visual context
6. **Fact-Check Search** - Same as before
7. **Logical Consistency Check** - NEW: Analyze contradictions
8. **Enhanced Analysis** - Weighted scoring with all new factors
9. **Reddit Fallback** - NEW: Search Reddit if no Google results
10. **Comprehensive Storage** - Store all analysis data

### New Configuration Options
```env
# Added to config.template and .env
TEMP_FRAMES_DIR=./temp/frames/
```

### New Dependencies
All new features use existing dependencies:
- **ffmpeg** - For frame extraction
- **axios** - For Reddit API calls
- **@google/generative-ai** - For video and consistency analysis

## 📊 Analysis Output Structure

The enhanced analysis now returns:

```javascript
{
  verdict: 'True|False|Mixed|Unknown',
  confidence: 'High|Medium|Low',
  summary: 'Enhanced summary with visual context',
  sources: [...], // Fact-check sources
  
  // NEW FIELDS:
  videoAnalysis: {
    visual_description: '...',
    audio_visual_alignment: '...',
    credibility_indicators: [...],
    text_elements: [...],
    logical_consistency: '...',
    red_flags: [...],
    production_assessment: '...'
  },
  
  logicalConsistency: {
    consistency_score: 0.0-1.0,
    consistency_level: 'HIGH|MEDIUM|LOW|VERY_LOW',
    contradictions_found: [...],
    logical_fallacies: [...],
    evidence_alignment: '...',
    credibility_assessment: '...',
    weight_adjustment: -0.3 to 0.3
  },
  
  redditAnalysis: { // Only when used as fallback
    sentiment: 'STRONGLY_SUPPORTS|SUPPORTS|NEUTRAL|SKEPTICAL|DEBUNKS',
    confidence: 0.0-1.0,
    verification_signals: [...],
    community_consensus: '...',
    credible_sources_mentioned: [...],
    misinformation_flags: [...]
  },
  
  analysisDetails: {
    totalSources: number,
    latestSourcePriority: true,
    falseRatio: '0.00',
    trueRatio: '0.00', 
    mixedRatio: '0.00',
    aiInferenceUsed: boolean,
    logicalConsistencyUsed: boolean,
    videoAnalysisUsed: boolean
  }
}
```

## 🎯 Key Benefits

1. **More Accurate Verdicts**: Logical consistency checking prevents contradictory claims from being marked as true
2. **Better Coverage**: Reddit integration provides verification for claims not covered by professional fact-checkers
3. **Enhanced Accessibility**: Video frame analysis provides audio descriptions for visual content
4. **Comprehensive Context**: Users get full visual and logical analysis, not just audio transcription
5. **Weighted Intelligence**: Recent sources and logical consistency are properly weighted in final decisions

## 🚀 Usage

The enhanced features are automatically activated when processing Instagram reels. No changes needed to the existing API - all new data is included in the response structure.

### Example Enhanced Response Summary:

**Before**: "Based on 2 fact-check sources, this claim appears to be false."

**After**: 
```
📊 LATEST ARTICLE ANALYSIS (prioritizing most recent reporting)

🔍 Primary Analysis: Latest article from Snopes (2024-09-20)
🤖 AI Independent Inference: FALSE (HIGH confidence)
📋 Evidence Found: Multiple sources confirm this claim has been debunked with photographic evidence showing manipulation.

🎯 Key Facts from Article:
  1. Original image was digitally altered
  2. Event occurred on different date than claimed  
  3. Multiple news outlets confirmed fabrication

⭐ FINAL VERDICT: DEBUNKED FALSE - Latest reporting contradicts this claim
📈 Confidence Level: High (Based on independent AI analysis of latest article content)

🧠 Logical Consistency: HIGH (0.9) - No contradictions found between evidence and conclusion
🖼️ Visual Analysis: Production quality suggests amateur editing with visible artifacts
```

## 🔄 Fallback Behavior

When Google Fact Checker returns no results, the system now:
1. Searches Reddit for community discussions
2. Analyzes sentiment and verification signals
3. Provides Reddit-based verdict with appropriate confidence levels
4. Clearly labels the source as community-based rather than professional fact-checking

This ensures users always get some form of verification analysis, even for very recent or obscure claims.
