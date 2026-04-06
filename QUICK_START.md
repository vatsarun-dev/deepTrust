# 🚀 Quick Start Guide

## Setup (5 minutes)

### 1️⃣ Get API Keys

**GNews** (Free - 100 requests/day):
- https://gnews.io/ → Sign up → Copy API key

**Puter.ai** (For AI):
- https://puter.com/ → Create account → Get API token

### 2️⃣ Configure Backend

```bash
cd backend
copy .env.example .env
# Edit .env and add your keys
npm install
npm run dev
```

### 3️⃣ Test

```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Is it true CSK won IPL in 2021?"}'
```

---

## Files Overview

```
backend/
├── services/
│   ├── aiService.js          ← NEW: AI analysis with advanced prompting
│   ├── gnewsService.js       ← Existing: News fetching
│   └── fakeNewsService.js    ← Enhanced: Combines AI + GNews
│
├── .env                       ← Add your API keys here
├── test-ai.js                 ← NEW: Test script
├── setup.bat / setup.sh       ← NEW: Automated setup
│
└── Documentation:
    ├── ENHANCED_AI_README.md      ← Full setup guide
    ├── API_DOCUMENTATION.md        ← API reference
    └── ENHANCEMENT_SUMMARY.md      ← What's new
```

---

## API Usage

**POST** `/api/analyze`

```javascript
// Request
{
  "text": "Your claim to verify"
}

// Response
{
  "status": "True|Fake|Unverified|Misleading",
  "result": "Real|Fake|null",
  "confidence": 92,
  "explanation": "Detailed reasoning...",
  "ai_analysis": {
    "key_facts": ["fact1", "fact2"],
    "red_flags": ["flag1"],
    "sources_assessment": "evaluation"
  },
  "sources": [...]
}
```

---

## Status Meanings

| Status | Meaning |
|--------|---------|
| **True** | Verified correct (confidence ≥75%) |
| **Likely True** | Probably true (60-74%) |
| **Unverified** | Can't confirm |
| **Likely Fake** | Probably false (60-74%) |
| **Fake** | Verified false (≥75%) |
| **Misleading** | Contains deceptive elements |

---

## Example Queries

✅ **Sports**: "Did Argentina win FIFA World Cup 2022?"  
✅ **Events**: "Did event X happen on date Y?"  
✅ **Facts**: "CSK won IPL in 2021"  
✅ **Science**: "Scientists found cure for cancer"  

---

## Debugging

Enable logs in `.env`:
```env
DEBUG_ANALYSIS=true
```

Run test:
```bash
node test-ai.js
```

---

## Environment Variables

```env
# Required
GNEWS_API_KEY=your_key          # From gnews.io
PUTER_API_TOKEN=your_token      # From puter.com

# Optional
DEBUG_ANALYSIS=false
PORT=5000
```

---

## What Changed?

**Before**: Basic keyword matching with GNews  
**After**: AI analyzes claim + news sources = better accuracy

**Key Improvements**:
- ✅ Context-aware AI analysis
- ✅ Fact extraction (dates, names, numbers)
- ✅ Red flag detection
- ✅ Source credibility assessment
- ✅ Detailed reasoning

---

## Common Issues

❌ **"Unverified" results**
→ Try more specific queries or check if topic has news coverage

❌ **"AI analysis failed"**  
→ Check PUTER_API_TOKEN is configured correctly

❌ **"No articles found"**
→ Verify GNEWS_API_KEY and check rate limits (100/day free)

---

## Need Help?

📖 **Full Docs**: `backend/ENHANCED_AI_README.md`  
🔧 **API Reference**: `backend/API_DOCUMENTATION.md`  
🎯 **What's New**: `ENHANCEMENT_SUMMARY.md`

---

**Ready to fact-check! 🎉**
