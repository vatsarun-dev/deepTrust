"# DeepTrust - AI-Powered Fake News Detection

> Advanced fact-checking platform with real-time news verification and AI analysis

## 🌟 Features

- **Advanced AI Analysis**: Uses Claude 3.5 Sonnet for sophisticated fact-checking
- **Real-Time News**: Fetches and cross-references with GNews API
- **Multi-Modal**: Analyzes both text claims and images
- **Smart Prompting**: Advanced prompt engineering for accurate results
- **Confidence Scoring**: Transparent confidence levels with detailed reasoning

## 🚀 Quick Start

### Backend Setup

1. **Navigate to backend:**
   ```bash
   cd backend
   ```

2. **Run setup script:**
   
   **Windows:**
   ```bash
   setup.bat
   ```
   
   **Linux/Mac:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Configure API keys in `.env`:**
   - Get GNEWS_API_KEY from https://gnews.io/ (free: 100 requests/day)
   - Get PUTER_API_TOKEN from https://puter.com/ (for AI analysis)

4. **Start the server:**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

## 📖 Example Usage

**Query:** "Is it true CSK won IPL in 2021?"

**Response:**
```json
{
  "status": "True",
  "result": "Real",
  "confidence": 92,
  "explanation": "Chennai Super Kings (CSK) won the IPL 2021...",
  "ai_analysis": {
    "key_facts": [
      "CSK won IPL 2021 on October 15, 2021",
      "They defeated Kolkata Knight Riders in the final"
    ],
    "red_flags": [],
    "sources_assessment": "Multiple credible sports sources confirm"
  },
  "sources": [
    {
      "title": "CSK Wins IPL 2021",
      "source": "ESPN Cricinfo",
      "url": "https://..."
    }
  ]
}
```

## 🔧 How It Works

1. **User Query** → System extracts keywords
2. **GNews Search** → Finds relevant news articles  
3. **AI Analysis** → Claude analyzes claim + evidence
4. **Smart Verdict** → Returns verdict with reasoning

## 📚 Documentation

- **Backend API**: See `backend/ENHANCED_AI_README.md`
- **GNews Logging**: See `backend/GNEWS_LOGGING_GUIDE.md` 📊
- **Testing**: Run `node backend/test-ai.js`
- **Test GNews Data**: Run `node backend/test-gnews-logging.js`

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB
- **AI**: Puter.ai (Claude 3.5 Sonnet)
- **News API**: GNews.io
- **Image Detection**: Sightengine

## 📝 License

MIT
" 
