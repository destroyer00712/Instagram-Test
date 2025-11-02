# WhatsApp Fact-Checking Workflow

## Overview

The WhatsApp bot now features a comprehensive fact-checking workflow that analyzes messages for logical inconsistencies, extracts verifiable claims, and searches for articles to verify information. It also handles multiple media types including YouTube videos, images, videos, and audio.

## Features

### 1. **Text Message Processing**

When a user sends a text message, the system follows this workflow:

#### Step 1: YouTube Link Detection
- Automatically detects YouTube links in any format:
  - `https://www.youtube.com/watch?v=...`
  - `https://youtu.be/...`
  - `https://www.youtube.com/shorts/...`
  - `https://www.youtube.com/embed/...`
  
- Extracts video metadata using YouTube's oembed API (no API key required)
- Combines video title with the user's message text
- Extracts claims from the combined content
- Fact-checks the claims using Google Custom Search

#### Step 2: Logical Inconsistency Analysis
- Analyzes text for:
  - **Logical fallacies** (ad hominem, straw man, false dichotomy, etc.)
  - **Internal contradictions** (claims that contradict each other)
  - **Misleading statistics** (misuse of numbers or data)
  - **Emotional manipulation** (appeals to fear, anger without evidence)
  - **Missing context** (claims that leave out important information)
  
- Severity levels:
  - **HIGH**: Major logical flaws or deliberate misinformation tactics
  - **MEDIUM**: Some questionable reasoning or missing context
  - **LOW**: Minor issues or mostly sound reasoning

#### Step 3: Claim Extraction
- Uses AI to extract verifiable factual claims from the text
- Ignores:
  - Opinions ("This policy is bad")
  - Vague statements ("Things are getting worse")
  - Questions ("What do you think?")
  - Casual conversation ("How are you?")

#### Step 4: Importance Assessment
- Determines if the claim is important enough to fact-check
- Considers:
  - Logical inconsistencies found
  - Message length (>50 characters)
  - Presence of news-related keywords (news, breaking, reported, etc.)

#### Step 5: Article Search & Fact-Checking
- Searches Google Custom Search for relevant articles
- Scrapes article content
- Uses AI to analyze each article against the claim
- Provides verdict: TRUE, FALSE, MIXED, or UNCLEAR

#### Step 6: Results Delivery
- Concise verdict with confidence level
- Source count
- Logical inconsistency warnings (if applicable)
- Media type indicator (for YouTube, images, etc.)

### 2. **Media Processing**

#### **Videos**
- Downloads the video file
- Extracts audio and video frames in parallel
- Transcribes audio using Gemini AI
- Analyzes video frames for visual context
- Extracts claims from audio + video + caption
- Fact-checks the extracted claims

#### **Images**
- Uses Gemini Vision API to extract text from images (OCR)
- Extracts:
  - Main text content
  - Headlines or titles
  - Captions or subtitles
  - Text overlays
  - Numbers or statistics
- Combines extracted text with caption
- Processes as text through the fact-checking workflow

#### **Audio**
- Transcribes audio using Gemini AI
- Processes transcription as text through the fact-checking workflow

### 3. **Response Format**

#### Successful Fact-Check
```
✅ TRUE - This checks out!
🎯 High confidence • 5 sources checked
🎥 Analyzed YouTube video

💬 Ask "tell me more" for details!
```

#### With Logical Issues
```
❌ FALSE - This claim is incorrect
📊 Medium confidence • 3 sources checked
⚠️ Logical issues detected (HIGH severity)

💬 Ask "tell me more" for details!
```

#### No Claim Found
```
🤔 I analyzed the text for logical issues, but couldn't find specific factual claims to verify.
⚠️ Note: The text contains significant logical inconsistencies.

💡 Try sharing news articles, videos, or factual claims!
```

## User Interaction Examples

### Example 1: YouTube Link
**User sends:**
```
https://www.youtube.com/watch?v=abc123 
Check this out!
```

**Bot response:**
```
🔍 Analyzing your message for fact-checking... Please wait.

✅ TRUE - This checks out!
🎯 High confidence • 4 sources checked
🎥 Analyzed YouTube video

💬 Ask "tell me more" for details!
```

### Example 2: Text with Claim
**User sends:**
```
Breaking: The government just announced a new policy that 
requires all companies to pay employees double salary.
```

**Bot response:**
```
🔍 Analyzing your message for fact-checking... Please wait.

❌ FALSE - This claim is incorrect
📊 Medium confidence • 3 sources checked

💬 Ask "tell me more" for details!
```

### Example 3: Image with Text
**User sends:** Image with text overlay saying "Company X bought Company Y for $1 billion"

**Bot response:**
```
🔍 Analyzing your message for fact-checking... Please wait.

✅ TRUE - This checks out!
🎯 High confidence • 5 sources checked
🖼️ Extracted text from image

💬 Ask "tell me more" for details!
```

### Example 4: Forwarded Message
**User forwards:** Message with claims about a conspiracy theory

**Bot response:**
```
🔍 Analyzing your message for fact-checking... Please wait.

❌ FALSE - This claim is incorrect
🤔 Low confidence • 2 sources checked
⚠️ Logical issues detected (HIGH severity)

💬 Ask "tell me more" for details!
```

## Technical Details

### Modules

#### `factChecker.js`
- `processWhatsAppText(senderId, messageText)` - Main text processing function
- `processWhatsAppMedia(senderId, mediaData)` - Main media processing function
- `detectYouTubeLink(text)` - Detects YouTube URLs
- `extractYouTubeData(videoUrl, videoId)` - Extracts video metadata
- `analyzeLogicalConsistency(text)` - Analyzes for logical fallacies
- `extractClaimFromText(text)` - Extracts verifiable claims
- `searchFactChecks(claim)` - Searches Google Custom Search for articles
- `analyzeFactChecks(results, claim)` - Analyzes article results

#### `whatsappMessageHandler.js`
- `processTextMessage(senderId, messageText)` - Routes text messages
- `processMediaMessage(senderId, attachments)` - Routes media messages
- `determineResponse(messageText, senderId)` - Determines if message needs fact-checking
- `updateContextForNewContent(senderId, contentId, claim)` - Updates conversation context

### AI Models Used

- **Gemini 2.5 Pro**: Primary model for claim analysis, transcription, and visual analysis
- **Gemini 2.0 Flash**: Fallback model if quota exceeded

### External APIs

- **Google Custom Search API**: For finding relevant articles
- **YouTube oembed API**: For extracting video metadata (no API key required)
- **Gemini AI API**: For transcription, vision, and text analysis

## Configuration

### Environment Variables Required

```bash
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Google Custom Search
GOOGLE_CUSTOM_SEARCH_API_KEY=your_google_search_key
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token

# Temporary file storage
TEMP_VIDEO_DIR=./temp/videos/
TEMP_AUDIO_DIR=./temp/audio/
TEMP_FRAMES_DIR=./temp/frames/
```

## Workflow Diagram

```
User Message
    ↓
Is it a command? → Yes → Send response
    ↓ No
Does it need fact-checking?
    ↓ Yes
Send "Analyzing..." message
    ↓
Has YouTube link? → Yes → Extract video data
    ↓ No
Analyze logical consistency
    ↓
Extract verifiable claim
    ↓
Is claim important? → No → Send "No claims found"
    ↓ Yes
Search articles (Google Custom Search)
    ↓
Analyze articles with AI
    ↓
Generate verdict
    ↓
Send result to user
```

## Performance Considerations

- **Vector cache disabled** by default for performance (can be enabled with `ENABLE_VECTOR_CACHE = true`)
- **Parallel processing** for audio transcription and video frame analysis
- **Article content caching** to avoid repeated scraping
- **Timeout protection** for all API calls
- **Cleanup** of temporary files after processing

## Future Enhancements

Potential improvements:
1. Support for more video platforms (TikTok, Instagram direct videos)
2. Multi-language support for non-English content
3. Historical claim tracking across users
4. Automatic source credibility scoring
5. Real-time fact-check updates from breaking news
6. Document processing (PDFs, Word files)
7. Support for voice notes with different accents/languages

## Limitations

- YouTube video processing only extracts metadata, not actual video content
- Image OCR works best with clear, high-contrast text
- Article scraping may fail on sites with heavy JavaScript or paywalls
- Logical inconsistency detection is AI-based and may have false positives/negatives
- Fact-checking accuracy depends on availability of reliable sources
- Processing time varies based on content complexity (10-60 seconds typical)

## Error Handling

The system gracefully handles:
- API quota exceeded (automatic fallback to alternative models)
- Network timeouts (with appropriate error messages)
- Invalid media formats (clear user feedback)
- Missing or corrupted files (cleanup and error reporting)
- Failed article scraping (tries multiple sources)
- AI parsing errors (manual extraction fallbacks)

