# Timeline Search Fix 📅

## Problem Solved

The original Google Fact Check API implementation had a hardcoded `maxAgeDays: 30` parameter, which caused the system to fail when users shared older content or when claims were older than 30 days.

## Solution Implemented

### 1. Progressive Timeline Search Strategy 🔄

The system now uses a progressive search approach that tries multiple timeline windows:

```javascript
const timelineStrategies = [
  { maxAgeDays: 30, description: "last 30 days" },     // Most recent
  { maxAgeDays: 90, description: "last 90 days" },     // 3 months
  { maxAgeDays: 365, description: "last year" },       // 1 year
  { maxAgeDays: 1825, description: "last 5 years" },   // 5 years
  { description: "all time" }                          // No limit
];
```

### 2. Smart Age Detection 🧠

The system attempts to detect video age from:
- **Caption text** - looks for date patterns like "2023-05-15", "May 15, 2023"
- **URL patterns** - extracts dates from Instagram URLs when possible
- **Common date formats** - MM/DD/YYYY, DD-MM-YYYY, Month DD, YYYY

### 3. Optimized Search Strategy 🎯

Based on detected age, the system starts from the most appropriate timeline:
- **0-30 days**: Start with "last 30 days"
- **31-90 days**: Start with "last 90 days"  
- **91-365 days**: Start with "last year"
- **1-5 years**: Start with "last 5 years"
- **>5 years or unknown**: Start with "all time"

## How It Works

### Before (Broken):
```
User shares 6-month-old video
↓
System searches only last 30 days
↓
No results found → System fails
```

### After (Fixed):
```
User shares 6-month-old video
↓
System detects age: ~180 days
↓
Starts search with "last year" strategy
↓
Finds relevant fact-checks → Success!
```

### Progressive Fallback:
```
User shares recent video
↓
Try "last 30 days" → No results
↓
Try "last 90 days" → No results  
↓
Try "last year" → Found results!
↓
Success with older fact-checks
```

## Enhanced Output

The system now provides transparency about its search strategy:

```javascript
{
  verdict: "False",
  confidence: "High",
  summary: "...",
  analysisDetails: {
    searchStrategy: "last year",
    totalStrategiesTried: 3,
    estimatedVideoAge: 180
  }
}
```

## Benefits

1. **No More Timeline Failures** - System never fails due to age restrictions
2. **Intelligent Optimization** - Starts search from most likely timeline
3. **Complete Coverage** - Eventually searches all time if needed
4. **Performance Efficient** - Avoids unnecessary broad searches for recent content
5. **Transparent Reporting** - Users see which timeline strategy found results

## Example Scenarios

### Scenario 1: Recent Viral Video
- **Content**: Today's viral claim
- **Detection**: No date found
- **Strategy**: Progressive (30 days → 90 days → found!)
- **Result**: Quick discovery of recent fact-checks

### Scenario 2: Old Resurfaced Content  
- **Content**: "Breaking: 2019 election fraud evidence"
- **Detection**: Detects "2019" → ~1400 days old
- **Strategy**: Starts with "last 5 years"
- **Result**: Finds historical fact-checks immediately

### Scenario 3: Undated Content
- **Content**: Generic conspiracy theory
- **Detection**: No date patterns found
- **Strategy**: Progressive search (30d → 90d → 1yr → 5yr → all time)
- **Result**: Comprehensive search ensures nothing is missed

## Technical Implementation

The fix is backward-compatible and adds these new functions:

- `detectVideoAge(videoUrl, caption)` - Age detection from metadata
- Enhanced `searchFactChecks(claim, videoUrl, caption)` - Progressive timeline search
- Timeline information in analysis results

No breaking changes to existing API or functionality.
