# WhatsApp Bot Testing Guide

## Quick Test Scenarios

Use these test cases to verify the enhanced WhatsApp fact-checking functionality.

## 🧪 Test Cases

### Test 1: Basic Text Claim
**Send to bot:**
```
Breaking news: Apple just announced they're buying Tesla for $500 billion.
```

**Expected behavior:**
1. Bot sends "🔍 Analyzing your message..."
2. Detects this is a factual claim
3. Analyzes logical consistency
4. Searches for articles
5. Returns verdict (likely FALSE or MIXED depending on actual news)

**Expected response format:**
```
❌ FALSE - This claim is incorrect
📊 Medium confidence • X sources checked

💬 Ask "tell me more" for details!
```

---

### Test 2: YouTube Link
**Send to bot:**
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
Check this video about the new policy!
```

**Expected behavior:**
1. Bot detects YouTube link
2. Extracts video metadata
3. Combines title with your message
4. Fact-checks the claim
5. Returns verdict with YouTube indicator

**Expected response format:**
```
✅/❌/⚠️ [VERDICT]
🎯/📊/🤔 [Confidence] • X sources checked
🎥 Analyzed YouTube video

💬 Ask "tell me more" for details!
```

---

### Test 3: Text with Logical Fallacies
**Send to bot:**
```
Everyone knows that vaccine side effects are being covered up by 
the government. If you disagree, you're probably part of the 
conspiracy too. Wake up!
```

**Expected behavior:**
1. Detects logical fallacies (ad hominem, appeal to fear)
2. Marks severity as HIGH
3. Attempts to extract verifiable claims
4. Returns verdict with logical warning

**Expected response format:**
```
❌ FALSE - This claim is incorrect
📊 Low confidence • X sources checked
⚠️ Logical issues detected (HIGH severity)

💬 Ask "tell me more" for details!
```

---

### Test 4: Image with Text
**Send to bot:**
- Screenshot of a news article headline
- Social media post with claims
- Infographic with statistics

**Expected behavior:**
1. Extracts text using OCR
2. Analyzes extracted text
3. Fact-checks claims
4. Returns verdict with image indicator

**Expected response format:**
```
✅/❌/⚠️ [VERDICT]
🎯/📊/🤔 [Confidence] • X sources checked
🖼️ Extracted text from image

💬 Ask "tell me more" for details!
```

---

### Test 5: Casual Conversation (Should NOT fact-check)
**Send to bot:**
```
Hi, how are you?
```

**Expected behavior:**
1. Recognizes as casual conversation
2. Does NOT trigger fact-checking
3. Responds conversationally

**Expected response:**
```
Hi! I'm a fact-checking bot. Share news, articles, or media with 
factual claims and I'll analyze them for you! 🔍
```

---

### Test 6: Short Opinion (Should NOT fact-check)
**Send to bot:**
```
I think this is bad.
```

**Expected behavior:**
1. Recognizes as opinion without verifiable claim
2. Does NOT trigger full fact-checking
3. Responds appropriately

**Expected response:**
```
🤔 No factual claims found to fact-check.

💡 Try sharing news articles, videos, or factual claims!
```

---

### Test 7: "Tell Me More" Follow-up
**Send to bot:**
First: Any fact-checked message
Then: 
```
tell me more
```

**Expected behavior:**
1. Retrieves last fact-check
2. Generates detailed explanation with AI
3. Returns comprehensive details

**Expected response:**
```
[Detailed explanation of the fact-check, including:
- Why the verdict was reached
- What sources said
- Key evidence points
- Context and nuances]
```

---

### Test 8: History Request
**Send to bot:**
```
history
```

**Expected behavior:**
1. Retrieves user's recent fact-checks
2. Shows last 3 fact-checks with verdicts

**Expected response:**
```
📚 Your Recent Fact-Checks:

1. "[First claim...]"
   Verdict: TRUE

2. "[Second claim...]"
   Verdict: FALSE

💬 Ask me about any of these or share new content to fact-check!
```

---

### Test 9: Multiple Claims in One Message
**Send to bot:**
```
I heard that the government increased taxes by 50% and also 
that unemployment dropped to 2% last month. Is this true?
```

**Expected behavior:**
1. AI extracts the primary claim
2. Fact-checks the most important claim
3. May mention multiple claims in analysis

**Expected response:**
```
⚠️ MIXED - Evidence goes both ways
📊 Medium confidence • X sources checked

💬 Ask "tell me more" for details!
```

---

### Test 10: URL in Text (Non-YouTube)
**Send to bot:**
```
Check this article: https://example.com/news/article-123
It says something important!
```

**Expected behavior:**
1. Recognizes URL but not YouTube
2. Processes the text around it
3. May attempt to extract claim from message
4. Fact-checks if claim found

---

## 🎬 Video/Audio Tests

### Test 11: WhatsApp Video
**Send to bot:**
- Short video with spoken claims
- Video with text overlays

**Expected behavior:**
1. Downloads video
2. Extracts audio and frames
3. Transcribes audio
4. Analyzes video frames
5. Extracts claims from all sources
6. Fact-checks

**Expected response:**
```
✅/❌/⚠️ [VERDICT]
🎯/📊/🤔 [Confidence] • X sources checked
📹 Analyzed video + audio

💬 Ask "tell me more" for details!
```

**Note:** May take 30-60 seconds to process.

---

### Test 12: WhatsApp Audio/Voice Note
**Send to bot:**
- Voice message with spoken claims

**Expected behavior:**
1. Transcribes audio
2. Extracts claims from transcription
3. Fact-checks claims

**Expected response:**
```
✅/❌/⚠️ [VERDICT]
🎯/📊/🤔 [Confidence] • X sources checked
🎵 Transcribed audio

💬 Ask "tell me more" for details!
```

---

## 🐛 Edge Cases to Test

### Test 13: Very Long Message
**Send to bot:**
- 500+ word message with multiple claims

**Expected behavior:**
- Should extract primary claim
- May take longer to process
- Should still complete successfully

---

### Test 14: Non-English Text
**Send to bot:**
```
[Text in another language with claims]
```

**Expected behavior:**
- May have reduced accuracy
- Should still attempt to process
- English sources may limit fact-checking

---

### Test 15: Emoji-Heavy Message
**Send to bot:**
```
🚨🚨🚨 BREAKING 🚨🚨🚨
The CEO 💼 just resigned 😱😱
This is HUGE 🔥🔥🔥
```

**Expected behavior:**
- Should extract claim despite emojis
- Ignores emojis in analysis
- Focuses on factual content

---

## 📊 Performance Tests

### Test 16: Rapid Fire Messages
**Send to bot:**
- Send 5 messages in quick succession

**Expected behavior:**
- Each message processed independently
- Responses come back as they complete
- No messages dropped
- No duplicate processing

---

### Test 17: Large Media Files
**Send to bot:**
- Large video file (10MB+)
- High-resolution image

**Expected behavior:**
- Downloads successfully
- Processes without crashing
- May take longer
- Cleanup happens automatically

---

## 🔧 Error Handling Tests

### Test 18: Corrupted Media
**Send to bot:**
- Corrupted image file
- Invalid video format

**Expected behavior:**
- Graceful error message
- No crash
- Clear user feedback

**Expected response:**
```
❌ Sorry, I encountered an error while fact-checking this content. 
Please try again later.
```

---

### Test 19: Network Issues Simulation
**Test when:**
- Google Search API quota exceeded
- Gemini API rate limited

**Expected behavior:**
- Falls back to alternative models
- Provides degraded but functional service
- Clear error messages if total failure

---

## ✅ Success Criteria

For each test, verify:
- [ ] Bot responds within reasonable time
- [ ] Response format is correct
- [ ] Verdict makes sense
- [ ] No crashes or errors
- [ ] Temp files cleaned up (check temp/ directory)
- [ ] Logs are informative
- [ ] User experience is smooth

---

## 🎯 Priority Test Order

**Essential (Must Work):**
1. Test 1: Basic Text Claim
2. Test 2: YouTube Link
3. Test 5: Casual Conversation
4. Test 7: Tell Me More

**Important (Should Work):**
5. Test 3: Logical Fallacies
6. Test 4: Image with Text
7. Test 8: History Request
8. Test 11: WhatsApp Video

**Nice to Have (Can Have Issues):**
9. Test 12: Audio/Voice
10. Test 14: Non-English
11. Test 17: Large Files

---

## 🐛 Known Issues & Workarounds

### Issue: Processing takes too long
**Workaround:** This is normal for videos (30-60s). Adjust user expectations.

### Issue: YouTube returns no metadata
**Workaround:** Falls back to user's message text for claim extraction.

### Issue: Article scraping fails
**Workaround:** Tries multiple articles, uses what's available.

### Issue: OCR misreads text
**Workaround:** User can send text directly or try clearer image.

---

## 📝 Testing Checklist

Before deployment:
- [ ] Test all basic scenarios (1-8)
- [ ] Test at least one media type (image, video, or audio)
- [ ] Test error handling (corrupted files)
- [ ] Verify temp file cleanup
- [ ] Check logs for errors
- [ ] Test with real-world forwarded messages
- [ ] Verify performance (response times)
- [ ] Test "tell me more" and history features
- [ ] Check conversation context switching

---

## 🚀 Real-World Test Suggestions

1. **Forward actual WhatsApp messages** that people share (with permission)
2. **Test popular YouTube videos** with controversial claims
3. **Use real news screenshots** from social media
4. **Try voice notes** about current events
5. **Test with friends/colleagues** to get natural usage patterns

---

## 📞 Support

If you encounter issues:
1. Check the logs in terminal
2. Verify temp/ directory isn't full
3. Check API quotas (Google, Gemini)
4. Restart the server if needed
5. Check environment variables are set

---

## 🎉 Success Indicators

The bot is working well if:
- ✅ Most verdicts make sense
- ✅ Logical warnings appear for problematic text
- ✅ YouTube links are detected and processed
- ✅ Images with clear text are read correctly
- ✅ Response times are acceptable
- ✅ Error messages are clear and helpful
- ✅ No memory leaks or crashes
- ✅ Users find it helpful and accurate

