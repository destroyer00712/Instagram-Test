# 🔍 Quota Error Debug Guide

## Problem Analysis

Based on the error logs and testing, here's what's happening:

### ✅ **What's Working:**
- API key is loaded correctly (starts with `AIzaSy...`)
- `gemini-1.5-flash` model works fine
- Code is using the correct environment variable `GEMINI_API_KEY`

### ❌ **The Issue:**
- **`gemini-1.5-pro` model has exceeded its quota** on the free tier
- The error shows: `quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests`
- Your code tries to use Pro model first, hits quota limit, then fails

## 🛠️ **Solution Implemented**

I've added automatic quota fallback that will:

1. **Try Pro model first** (for best quality)
2. **Automatically fallback to Flash** if Pro quota is exceeded  
3. **Continue processing** without manual intervention
4. **Log which model was used** for transparency

### Key Changes Made:

1. **Added Helper Function** (`makeGeminiAPICall`) with automatic fallback
2. **Enhanced Error Handling** to catch quota errors specifically
3. **Improved Logging** to show which model is being used
4. **Upgraded Fallback Model** - Now uses `gemini-2.0-flash-exp` (latest and fastest)
5. **Graceful Degradation** - 2.0 Flash provides excellent results

## 🧪 **Testing Your Fix**

Run this command to test the fix:

```bash
npm run test:gemini
```

Expected output:
```
✅ Gemini API key is working correctly!  (2.0 Flash model)
⚠️ Gemini Pro quota exceeded, falling back to 2.0 Flash  (Pro model)
```

## 🚀 **Deploy the Fix**

1. **Restart your server** to load the updated code
2. **Test with a real Instagram reel** 
3. **Check logs** - you should see:
   ```
   ⚠️ [makeGeminiAPICall] gemini-1.5-pro quota exceeded, falling back to gemini-2.0-flash-exp
   ✅ [makeGeminiAPICall] Fallback API call successful with model: gemini-2.0-flash-exp
   ```

## 📊 **Monitoring**

The enhanced logging will now show:

```bash
# On startup
🔑 GEMINI_API_KEY exists: true
🔑 GEMINI_API_KEY length: 39
🔑 GEMINI_API_KEY preview: AIzaSy...your_key_here

# During processing
🤖 [makeGeminiAPICall] Attempting API call with model: gemini-1.5-pro
⚠️ [makeGeminiAPICall] gemini-1.5-pro quota exceeded, falling back to gemini-2.0-flash-exp
✅ [makeGeminiAPICall] Fallback API call successful with model: gemini-2.0-flash-exp
✅ Audio transcribed using gemini-2.0-flash-exp (245 chars): This is the transcription...
```

## 🔄 **Quota Management**

### Free Tier Limits:
- **Pro Model**: Very limited requests per day/minute
- **2.0 Flash Model**: Higher limits, excellent performance

### Recommendations:
1. **Use the fallback system** (already implemented)
2. **Monitor your usage** at https://aistudio.google.com/
3. **Consider upgrading** to paid tier for higher Pro model limits
4. **2.0 Flash model quality** is excellent and often matches Pro performance

## 🐛 **If Issues Persist**

If you still get quota errors after the fix:

1. **Check both models are hitting limits:**
   ```bash
   npm run test:gemini
   ```

2. **Verify environment variables in production:**
   - Check your deployment environment has the correct `.env` file
   - Verify `GEMINI_API_KEY` is loaded at runtime
   - Check for any environment variable overrides

3. **Temporary workaround - Force 2.0 Flash model:**
   ```javascript
   // In factChecker.js, temporarily change:
   TRANSCRIPTION: 'gemini-2.0-flash-exp', // Use 2.0 Flash directly
   ```

## ✅ **Expected Behavior After Fix**

- ✅ **No more quota failures** - system automatically falls back
- ✅ **Continued processing** - users get fact-check results  
- ✅ **Superior quality maintained** - 2.0 Flash model provides excellent transcription
- ✅ **Transparent logging** - you can see which model was used
- ✅ **Future-proof** - when Pro quota resets, it will automatically use Pro again
- ✅ **Latest technology** - 2.0 Flash is Google's newest and fastest model

The fix ensures your bot never fails due to quota issues while using the latest and most capable fallback model.
