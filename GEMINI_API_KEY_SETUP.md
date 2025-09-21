# 🔑 Complete Guide: Getting Your Gemini API Key

## 🎯 **Quick Start - Google AI Studio (Recommended)**

### Step 1: Go to Google AI Studio
**URL**: https://aistudio.google.com/

### Step 2: Sign In
- Use your Google account (personal or work)
- Accept the terms of service

### Step 3: Get Your API Key
1. **Click "Get API Key"** (top right corner)
2. **Click "Create API Key"**
3. **Choose "Create API key in new project"** (recommended for new users)
4. **Copy the generated API key** - it will look like: `AIzaSy...` (39 characters)

### Step 4: Save Your API Key
```bash
# Add to your .env file
GEMINI_API_KEY=your_actual_key_here
```

---

## 🏢 **Alternative: Google Cloud Platform (GCP)**

If you prefer using GCP or need enterprise features:

### Step 1: Go to Google Cloud Console
**URL**: https://console.cloud.google.com/

### Step 2: Create or Select Project
1. **Create new project** or select existing one
2. **Enable the Generative Language API**
   - Go to "APIs & Services" → "Library"
   - Search for "Generative Language API"
   - Click "Enable"

### Step 3: Create API Key
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"API key"**
4. **Copy the generated key**
5. **Optional**: Click "Restrict Key" to add security restrictions

### Step 4: Configure Restrictions (Recommended)
1. **API restrictions**: Select "Generative Language API"
2. **Application restrictions**: 
   - Choose "IP addresses" and add your server IP
   - Or choose "HTTP referrers" for web apps

---

## 🆓 **Free Tier Limits & Pricing**

### Google AI Studio (Free Tier)
```
✅ FREE TIER INCLUDES:
- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per day

💰 PAID TIER ($0.002/1K tokens):
- Higher rate limits
- Priority access
- Production support
```

### Models Available:
- **Gemini 1.5 Pro**: Best quality, limited free tier
- **Gemini 1.5 Flash**: Fast, higher free limits
- **Gemini 2.0 Flash**: Latest, excellent performance (what we use as fallback)

---

## 🔧 **Setup in Your Project**

### 1. Add to Environment File
```bash
# In your .env file
GEMINI_API_KEY=your_actual_key_here
```

### 2. Test Your API Key
```bash
npm run test:gemini
```

Expected output:
```bash
✅ Gemini API key is working correctly!
🔑 GEMINI_API_KEY preview: AIzaSy...your_key_here
```

---

## 🛡️ **Security Best Practices**

### 1. Restrict Your API Key
- **Go to**: https://console.cloud.google.com/apis/credentials
- **Click your API key** → "Edit API key"
- **Add restrictions**:
  - API restrictions: Only "Generative Language API"
  - Application restrictions: Your server IP addresses

### 2. Environment Variables
```bash
# ✅ GOOD - Use environment variables
GEMINI_API_KEY=your_key_here

# ❌ BAD - Never hardcode in source code
const apiKey = "AIzaSy..."; // DON'T DO THIS
```

### 3. Monitor Usage
- **Check usage**: https://aistudio.google.com/
- **Set up alerts** for quota usage
- **Monitor costs** if using paid tier

---

## 🔍 **Troubleshooting Common Issues**

### Issue 1: "Invalid API Key"
```bash
❌ Error: [GoogleGenerativeAI Error]: API key not valid
```

**Solutions:**
1. **Check the key format** - should start with `AIzaSy` and be 39 characters
2. **Verify it's enabled** - go to Google AI Studio and check status
3. **Check restrictions** - make sure your IP/domain is allowed

### Issue 2: "Quota Exceeded"
```bash
❌ Error: [429 Too Many Requests] You exceeded your current quota
```

**Solutions:**
1. **Wait for quota reset** (resets daily)
2. **Upgrade to paid tier** for higher limits
3. **Use our fallback system** (already implemented in your code)

### Issue 3: "API Not Enabled"
```bash
❌ Error: Generative Language API has not been used
```

**Solutions:**
1. **Go to GCP Console** → APIs & Services → Library
2. **Search "Generative Language API"**
3. **Click "Enable"**

---

## 📊 **Monitoring Your Usage**

### Google AI Studio Dashboard
**URL**: https://aistudio.google.com/

**Shows:**
- Requests per day/minute
- Token usage
- Error rates
- Model-specific usage

### Google Cloud Console (if using GCP)
**URL**: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/

**Shows:**
- Detailed API analytics
- Quota usage graphs
- Error analysis
- Billing information

---

## 🚀 **Quick Setup Checklist**

- [ ] Go to https://aistudio.google.com/
- [ ] Sign in with Google account
- [ ] Click "Get API Key" → "Create API Key"
- [ ] Copy the key (starts with `AIzaSy`)
- [ ] Add to `.env` file: `GEMINI_API_KEY=your_key_here`
- [ ] Run `npm run test:gemini` to verify
- [ ] Restart your Instagram bot server
- [ ] Test with a real Instagram reel

---

## 💡 **Pro Tips**

1. **Multiple Keys**: Create separate keys for development/production
2. **Key Rotation**: Regularly rotate API keys for security
3. **Monitoring**: Set up usage alerts to avoid surprise quota limits
4. **Fallback**: Our code automatically handles quota issues with 2.0 Flash fallback
5. **Caching**: Consider caching results to reduce API calls

---

## 🆘 **Need Help?**

### Official Documentation:
- **Google AI Studio**: https://ai.google.dev/
- **API Reference**: https://ai.google.dev/api
- **Pricing**: https://ai.google.dev/pricing

### Your Project Status:
- ✅ **Quota fallback system**: Already implemented
- ✅ **2.0 Flash fallback**: Latest model configured  
- ✅ **Error handling**: Comprehensive logging added
- ✅ **Test script**: `npm run test:gemini` available

Just get your API key from Google AI Studio and add it to your `.env` file!
