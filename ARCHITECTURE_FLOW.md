# System Architecture & Flow

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐                     │
│  │  User Input  │────▶│   Submit     │                     │
│  │  Text/Image  │     │   Request    │                     │
│  └──────────────┘     └──────┬───────┘                     │
└───────────────────────────────┼──────────────────────────────┘
                                │ POST /api/analyze
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         analysisController.js                        │  │
│  │  ┌────────────────┐      ┌──────────────────┐       │  │
│  │  │  Text Analysis │      │  Image Analysis  │       │  │
│  │  └────────┬───────┘      └──────────┬───────┘       │  │
│  └───────────┼─────────────────────────┼───────────────┘  │
│              │                         │                   │
│              ▼                         ▼                   │
│  ┌──────────────────────┐  ┌──────────────────────┐      │
│  │  fakeNewsService.js  │  │ imageDetectionService│      │
│  └──────────┬───────────┘  └──────────────────────┘      │
│             │                                              │
│             ├─────────────┬──────────────┐                │
│             ▼             ▼              ▼                │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────┐         │
│  │ gnewsService │ │ aiService   │ │ Scoring   │         │
│  └──────┬───────┘ └──────┬──────┘ └───────────┘         │
│         │                │                                │
└─────────┼────────────────┼────────────────────────────────┘
          │                │
          ▼                ▼
┌──────────────────┐ ┌──────────────────┐
│   GNews API      │ │   Puter.ai       │
│  (News Search)   │ │ (Claude AI)      │
└──────────────────┘ └──────────────────┘
```

---

## 🔄 Request Flow (Step by Step)

### Standard Text Analysis Flow

```
1. User Input
   │
   └─▶ "Is it true CSK won IPL in 2021?"
       │
       ▼

2. Backend Receives Request
   │
   ├─▶ analysisController.analyzeContent()
   │   │
   │   └─▶ fakeNewsService.analyzeFakeNews(text)
   │       │
   │       ▼

3. Fetch News Articles (NEW + OLD)
   │
   ├─▶ gnewsService.fetchRelevantNews()
   │   │
   │   ├─▶ Extract keywords: "CSK", "IPL", "2021"
   │   │
   │   ├─▶ Build search queries
   │   │
   │   ├─▶ Call GNews API
   │   │
   │   └─▶ Returns: [Article1, Article2, Article3]
   │       │
   │       ▼

4. AI Analysis (NEW! ⭐)
   │
   ├─▶ aiService.analyzeWithAI(claim, articles)
   │   │
   │   ├─▶ Build advanced prompt:
   │   │   • System instructions (fact-checking rules)
   │   │   • Claim text
   │   │   • News articles as evidence
   │   │
   │   ├─▶ Send to Puter.ai (Claude 3.5 Sonnet)
   │   │
   │   ├─▶ AI analyzes:
   │   │   ✓ Cross-references with sources
   │   │   ✓ Checks dates, names, numbers
   │   │   ✓ Evaluates credibility
   │   │   ✓ Identifies red flags
   │   │   ✓ Extracts key facts
   │   │
   │   └─▶ Returns structured verdict:
   │       {
   │         verdict: "TRUE",
   │         confidence: 92,
   │         reasoning: "...",
   │         key_facts: [...],
   │         red_flags: [...]
   │       }
   │       │
   │       ▼

5. Result Processing
   │
   ├─▶ If AI confidence ≥ 60%:
   │   └─▶ Use AI result (enhanced accuracy!)
   │
   └─▶ Else:
       └─▶ Fallback to GNews scoring (original method)
       │
       ▼

6. Response to Frontend
   │
   └─▶ {
       status: "True",
       result: "Real",
       confidence: 92,
       explanation: "Detailed reasoning...",
       ai_analysis: {
         key_facts: [...],
         red_flags: [...],
         sources_assessment: "..."
       },
       sources: [...]
     }
```

---

## 🎯 Advanced Prompting System

### System Prompt (Instructions to AI)

```
┌─────────────────────────────────────────────────────────┐
│  You are an expert fact-checker. Analyze with:          │
│                                                          │
│  1. Critical thinking                                   │
│  2. Evidence-based reasoning                            │
│  3. Source evaluation                                   │
│  4. Logical consistency checks                          │
│  5. Bias detection                                      │
│                                                          │
│  Provide structured output:                             │
│  - Verdict                                              │
│  - Confidence score                                     │
│  - Detailed reasoning                                   │
│  - Key facts                                            │
│  - Red flags                                            │
│  - Sources assessment                                   │
└─────────────────────────────────────────────────────────┘
```

### User Prompt (Context + Task)

```
┌─────────────────────────────────────────────────────────┐
│  Analyze this claim:                                     │
│  "Is it true CSK won IPL in 2021?"                      │
│                                                          │
│  Evidence from news:                                     │
│                                                          │
│  1. "CSK beat KKR to win IPL 2021"                      │
│     Source: ESPN Cricinfo                               │
│     Description: Chennai Super Kings...                 │
│                                                          │
│  2. "Chennai clinch fourth title"                       │
│     Source: ICC                                         │
│     Description: MS Dhoni led team...                   │
│                                                          │
│  3. "CSK win by 27 runs"                                │
│     Source: Cricbuzz                                    │
│     Description: Final held in Dubai...                 │
│                                                          │
│  Provide comprehensive fact-check analysis.             │
└─────────────────────────────────────────────────────────┘
```

### AI Response

```
┌─────────────────────────────────────────────────────────┐
│  {                                                       │
│    "verdict": "TRUE",                                   │
│    "confidence": 92,                                    │
│    "reasoning": "Chennai Super Kings did win IPL        │
│                  2021. The final was held on October    │
│                  15, 2021, in Dubai, where CSK          │
│                  defeated KKR by 27 runs. This is       │
│                  confirmed by multiple credible sports  │
│                  sources...",                           │
│    "key_facts": [                                       │
│      "CSK won on October 15, 2021",                    │
│      "Final held in Dubai",                            │
│      "Defeated KKR by 27 runs",                        │
│      "MS Dhoni was captain",                           │
│      "CSK's 4th IPL title"                             │
│    ],                                                   │
│    "red_flags": [],                                    │
│    "sources_assessment": "Multiple credible sports      │
│                           sources confirm. Details are  │
│                           consistent across sources."   │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Decision Tree

```
                     User Query
                         │
                         ▼
              ┌──────────────────┐
              │ Fetch GNews      │
              │ Articles         │
              └─────────┬────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
        Found 0                Found 1+
        articles              articles
            │                       │
            ▼                       ▼
    ┌───────────────┐      ┌───────────────┐
    │ Try AI        │      │ Send to AI    │
    │ (no context)  │      │ with articles │
    └───────┬───────┘      └───────┬───────┘
            │                      │
            ▼                      ▼
    ┌───────────────┐      ┌───────────────┐
    │ AI Failed?    │      │ AI Success?   │
    └───────┬───────┘      └───────┬───────┘
            │                      │
        Yes │   No         Yes     │    No
            │   │           │      │     │
            ▼   ▼           ▼      ▼     ▼
         ┌────┐ ┌────┐  ┌────┐ ┌────┐ ┌────┐
         │ Un │ │ AI │  │ AI │ │ AI │ │GNews│
         │ver.│ │Res.│  │Res.│ │Res.│ │Score│
         └────┘ └────┘  └────┘ └────┘ └────┘
            │     │        │      │      │
            └─────┴────────┴──────┴──────┘
                        │
                        ▼
                ┌───────────────┐
                │ Final Result  │
                │ to Frontend   │
                └───────────────┘
```

---

## 🔑 Key Components

### 1. aiService.js (NEW!)
```javascript
// Main functions:
- analyzeWithAI()           // Core AI analysis
- buildAdvancedPrompt()     // Prompt engineering
- mapVerdictToStatus()      // Convert AI verdict
- mapVerdictToResult()      // Map to result format
```

### 2. fakeNewsService.js (ENHANCED)
```javascript
// Enhanced with:
- AI integration            // Calls aiService
- Fallback logic           // Uses GNews if AI fails
- Priority system          // AI > GNews when conf ≥60%
```

### 3. gnewsService.js (EXISTING)
```javascript
// Already working:
- fetchRelevantNews()      // Get articles from GNews
- Query optimization       // Multiple search strategies
- Article deduplication    // Remove duplicates
```

---

## 🎨 Response Structure

```json
{
  "status": "True | Likely True | Unverified | Misleading | Likely Fake | Fake",
  "result": "Real | Fake | null",
  "confidence": 0-100,
  "explanation": "Human-readable analysis with reasoning",
  "source_match": "strong | weak | none",
  "source": "ai+gnews | gnews | fallback",
  
  "ai_analysis": {              // NEW! Only if AI used
    "key_facts": [
      "Specific verifiable fact 1",
      "Specific verifiable fact 2"
    ],
    "red_flags": [
      "Warning sign 1",
      "Warning sign 2"
    ],
    "sources_assessment": "Evaluation of source credibility"
  },
  
  "sources": [
    {
      "title": "Article title",
      "description": "Article description",
      "url": "https://...",
      "source": "Source name"
    }
  ]
}
```

---

## 🚦 Status Meanings

```
┌──────────────┬─────────────────────────────────────┐
│ Status       │ Meaning                             │
├──────────────┼─────────────────────────────────────┤
│ True         │ ✓ Verified true (conf ≥75%)        │
│ Likely True  │ ✓ Probably true (conf 60-74%)      │
│ Unverified   │ ? Cannot confirm                    │
│ Misleading   │ ⚠ Contains deceptive elements       │
│ Likely Fake  │ ✗ Probably false (conf 60-74%)     │
│ Fake         │ ✗ Verified false (conf ≥75%)       │
└──────────────┴─────────────────────────────────────┘
```

---

## 📈 Confidence Levels

```
90-100  ████████████████████ Very High
75-89   ███████████████░░░░░ High
60-74   ████████████░░░░░░░░ Moderate
40-59   ███████░░░░░░░░░░░░░ Low
0-39    ███░░░░░░░░░░░░░░░░░ Very Low
```

---

## 🎯 This is what makes your system advanced!

✅ **Context-aware** - AI sees the news articles  
✅ **Evidence-based** - Cross-references sources  
✅ **Transparent** - Explains reasoning clearly  
✅ **Fact-focused** - Extracts specific details  
✅ **Alert system** - Identifies red flags  
✅ **Reliable** - Falls back gracefully  

---

Ready to use! 🚀
