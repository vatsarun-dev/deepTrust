# DeepTrust Backend - Enhanced AI Integration

## Overview
Enhanced fake news verification system with advanced AI prompting and real-time news integration using GNews API and Puter.ai.

## Features

### 1. **Advanced AI Analysis**
- Uses Claude 3.5 Sonnet via Puter.ai for sophisticated fact-checking
- Provides detailed reasoning with key facts and red flags
- Analyzes logical consistency and source credibility
- Returns confidence scores and structured verdicts

### 2. **Real-Time News Integration**
- Fetches relevant news articles from GNews API
- Cross-references claims with current news sources
- Intelligent query optimization for better search results
- Deduplicates and ranks articles by relevance

### 3. **Multi-Source Analysis**
- Combines AI reasoning with news evidence
- Merges text and image analysis results
- Provides comprehensive verdict with source attribution

## Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- API Keys (see below)

### Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your API keys:**
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/DeepTrust
   
   # Get from: https://gnews.io/
   GNEWS_API_KEY=your_gnews_api_key
   
   # Get from: https://puter.com/ (for AI analysis)
   PUTER_API_TOKEN=your_puter_api_token
   
   # Get from: https://sightengine.com/ (for image analysis)
   SIGHTENGINE_API_USER=your_sightengine_user
   SIGHTENGINE_API_SECRET=your_sightengine_secret
   
   # Enable debug logs
   DEBUG_ANALYSIS=false
   ```

### Getting API Keys

#### 1. GNews API (Free tier: 100 requests/day)
- Visit https://gnews.io/
- Sign up for a free account
- Copy your API key
- Paste into `GNEWS_API_KEY`

#### 2. Puter.ai API (For AI Analysis)
- Visit https://puter.com/
- Create an account
- Navigate to API settings
- Generate an API token
- Paste into `PUTER_API_TOKEN`

#### 3. Sightengine (Optional - for image analysis)
- Visit https://sightengine.com/
- Sign up for an account
- Get your API credentials
- Add to `.env`

### Running the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will run on `http://localhost:5000`

## API Usage

### Analyze Text/Image Content

**Endpoint:** `POST /api/analyze`

**Request:**
```json
{
  "text": "Is it true CSK won IPL in 2021?"
}
```

**Response:**
```json
{
  "status": "True",
  "result": "Real",
  "confidence": 92,
  "explanation": "Chennai Super Kings (CSK) did win the IPL 2021 tournament...",
  "source_match": "strong",
  "sources": [
    {
      "title": "CSK Wins IPL 2021",
      "description": "Chennai Super Kings defeated...",
      "url": "https://...",
      "source": "ESPN Cricinfo"
    }
  ],
  "source": "ai+gnews",
  "ai_analysis": {
    "key_facts": [
      "CSK won IPL 2021 on October 15, 2021",
      "They defeated Kolkata Knight Riders in the final"
    ],
    "red_flags": [],
    "sources_assessment": "Multiple credible sports sources confirm this"
  }
}
```

**Status Values:**
- `True` - Verified as true with high confidence
- `Likely True` - Probably true but with some uncertainty
- `Fake` - Verified as false
- `Likely Fake` - Probably false
- `Misleading` - Contains misleading elements
- `Unverified` - Cannot be verified with available evidence

## How It Works

### Analysis Flow

1. **User submits claim** → "Is it true CSK won IPL in 2021?"

2. **GNews Search** → 
   - Extracts keywords: "CSK", "IPL", "2021"
   - Searches for relevant news articles
   - Returns top 3 matching articles

3. **AI Analysis** →
   - Receives claim + news sources
   - Analyzes with advanced prompting
   - Checks facts, dates, logical consistency
   - Identifies red flags and key facts
   - Returns structured verdict with reasoning

4. **Result Merging** →
   - Combines AI verdict with news evidence
   - Calculates final confidence score
   - Provides comprehensive explanation
   - Returns sources for verification

### Advanced Prompting System

The AI uses a sophisticated system prompt that instructs it to:
- Apply critical thinking and evidence-based reasoning
- Cross-reference with provided sources
- Identify logical fallacies and bias
- Consider temporal context
- Distinguish facts from opinions
- Evaluate source credibility

### Example Queries

**Sports Facts:**
```
"Did Argentina win the FIFA World Cup 2022?"
→ Returns: True (with news sources confirming)
```

**Political Claims:**
```
"Did the president announce new policy yesterday?"
→ Returns: True/False/Unverified (with recent news)
```

**Science Claims:**
```
"Scientists discovered cure for cancer"
→ Returns: Likely Fake/Misleading (with context)
```

## Debugging

Enable debug logs in `.env`:
```env
DEBUG_ANALYSIS=true
```

This will show:
- GNews search queries and results
- AI analysis requests and responses
- Confidence score calculations

## Performance

- **Average response time:** 2-5 seconds
- **GNews timeout:** 10 seconds
- **AI analysis:** 3-7 seconds
- **Caching:** None (real-time verification)

## Limitations

- **GNews free tier:** 100 requests/day
- **AI rate limits:** Depends on Puter.ai plan
- **Language:** English only for GNews
- **Recency:** Limited to recent news coverage

## Troubleshooting

**"No relevant news articles found"**
- Check GNEWS_API_KEY is valid
- Verify you haven't exceeded rate limits
- Try more specific queries

**"AI analysis failed"**
- Check PUTER_API_TOKEN is configured
- Verify Puter.ai service is accessible
- Check API quota

**"Unverified" results**
- Claim might be too old/new for news coverage
- Try rephrasing the query
- Check if topic is covered by mainstream news

## License
MIT
