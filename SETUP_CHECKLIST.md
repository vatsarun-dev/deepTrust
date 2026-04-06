# ✅ Setup Checklist

Use this checklist to get your enhanced DeepTrust system running.

---

## 📋 Pre-Setup

- [ ] Node.js installed (v14 or higher)
- [ ] MongoDB installed and running
- [ ] Code editor ready (VS Code recommended)
- [ ] Terminal/Command Prompt open

---

## 🔑 API Keys (Required)

### GNews API
- [ ] Visit https://gnews.io/
- [ ] Sign up for free account
- [ ] Verify email
- [ ] Copy API key from dashboard
- [ ] Save it somewhere safe

**Free Tier:** 100 requests/day

### Puter.ai API
- [ ] Visit https://puter.com/
- [ ] Create account
- [ ] Navigate to API settings
- [ ] Generate API token
- [ ] Copy and save token

---

## 🛠️ Backend Setup

### 1. Navigate to Backend
```bash
cd backend
```
- [ ] Done

### 2. Create Environment File
```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```
- [ ] Done

### 3. Edit .env File
Open `.env` and add your API keys:
```env
GNEWS_API_KEY=paste_your_key_here
PUTER_API_TOKEN=paste_your_token_here
DEBUG_ANALYSIS=false
```
- [ ] GNEWS_API_KEY added
- [ ] PUTER_API_TOKEN added
- [ ] File saved

### 4. Install Dependencies
```bash
npm install
```
- [ ] Installation completed without errors
- [ ] All packages installed successfully

### 5. Start Backend Server
```bash
# Development mode (with auto-reload)
npm run dev

# OR Production mode
npm start
```
- [ ] Server started successfully
- [ ] No errors in console
- [ ] Listening on port 5000

---

## 🧪 Testing

### 1. Health Check
```bash
curl http://localhost:5000/api/health
```
Expected response:
```json
{"success": true, "message": "DeepTrust backend is running"}
```
- [ ] Health check passed

### 2. Test Simple Query
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Is it true CSK won IPL in 2021?\"}"
```
- [ ] Request sent successfully
- [ ] Received response with status
- [ ] Received confidence score
- [ ] Received ai_analysis object
- [ ] Response time < 10 seconds

### 3. Run Test Suite
```bash
node test-ai.js
```
- [ ] Environment check passed
- [ ] GNews API working
- [ ] AI analysis working
- [ ] Multiple test cases completed

---

## 🎨 Frontend Setup (Optional)

### 1. Navigate to Root
```bash
cd ..
```
- [ ] Done

### 2. Install Dependencies
```bash
npm install
```
- [ ] Installation completed

### 3. Start Frontend
```bash
npm run dev
```
- [ ] Frontend started
- [ ] Can access at localhost (check console for port)

### 4. Test Integration
- [ ] Open frontend in browser
- [ ] Submit a test claim
- [ ] Verify results display correctly
- [ ] Check AI analysis is showing

---

## 🔍 Verification Checklist

### Backend Functionality
- [ ] Health endpoint returns 200
- [ ] Text analysis endpoint working
- [ ] GNews integration active
- [ ] AI analysis returning results
- [ ] Confidence scores make sense
- [ ] Sources being returned
- [ ] ai_analysis object present

### API Keys
- [ ] GNEWS_API_KEY is valid (not getting 401 errors)
- [ ] PUTER_API_TOKEN is valid (AI responses working)
- [ ] No rate limit errors (if any, check quotas)

### Response Quality
- [ ] Status values are correct (True/Fake/Unverified etc.)
- [ ] Confidence scores are realistic (0-100)
- [ ] Explanations are detailed and make sense
- [ ] Key facts are being extracted
- [ ] Sources have proper URLs and titles

---

## 📚 Documentation Read

- [ ] Read QUICK_START.md
- [ ] Read IMPLEMENTATION_COMPLETE.md
- [ ] Skimmed backend/ENHANCED_AI_README.md
- [ ] Reviewed backend/API_DOCUMENTATION.md
- [ ] Looked at FRONTEND_INTEGRATION.js examples
- [ ] Understood ARCHITECTURE_FLOW.md

---

## 🎯 Feature Testing

Test these types of queries:

### Sports Facts
- [ ] "Did Argentina win FIFA World Cup 2022?"
- [ ] "Is it true CSK won IPL in 2021?"
- [ ] Check: Should return TRUE with high confidence

### Recent Events
- [ ] "Did [recent event] happen?"
- [ ] Check: Should find news articles

### False Claims
- [ ] "The Earth is flat"
- [ ] "5G towers cause COVID-19"
- [ ] Check: Should return FALSE or MISLEADING

### Historical Facts
- [ ] "Did World War 2 end in 1945?"
- [ ] Check: Should return TRUE

### Unverifiable
- [ ] "My neighbor won the lottery"
- [ ] Check: Should return UNVERIFIED

---

## 🐛 Troubleshooting

### Issue: "Cannot find module"
- [ ] Run `npm install` in backend directory
- [ ] Check node_modules folder exists

### Issue: "GNEWS_API_KEY not configured"
- [ ] Check .env file exists in backend folder
- [ ] Verify GNEWS_API_KEY is set
- [ ] No quotes around the key value
- [ ] No extra spaces

### Issue: "AI analysis failed"
- [ ] Check PUTER_API_TOKEN is set
- [ ] Verify token is valid (try regenerating)
- [ ] Check internet connection
- [ ] System should still work (falls back to GNews)

### Issue: "No articles found"
- [ ] Check GNews API quota (100/day free)
- [ ] Try different query phrasing
- [ ] Verify internet connection
- [ ] Check GNews status page

### Issue: Port already in use
- [ ] Change PORT in .env to different number
- [ ] Or kill process using port 5000

### Issue: MongoDB connection failed
- [ ] Start MongoDB service
- [ ] Check MONGO_URI in .env
- [ ] Verify MongoDB is installed

---

## 🚀 Ready to Launch

All checked? You're ready!

- [ ] Backend running without errors
- [ ] API keys configured and working
- [ ] Test queries returning good results
- [ ] Frontend integrated (if applicable)
- [ ] Documentation reviewed

---

## 📝 Next Steps

After setup is complete:

1. **Customize prompting** (optional)
   - Edit `backend/services/aiService.js`
   - Modify `AI_SYSTEM_PROMPT` for your use case

2. **Adjust settings** (optional)
   - Change confidence thresholds
   - Modify number of articles fetched
   - Adjust timeouts

3. **Deploy** (when ready)
   - Set up production environment
   - Configure production MongoDB
   - Set up reverse proxy
   - Enable HTTPS
   - Set production API keys

4. **Monitor**
   - Watch API usage/quotas
   - Monitor response times
   - Check accuracy of results

---

## 🎉 Success!

If all items are checked, your enhanced DeepTrust system is ready to verify claims with advanced AI!

**Test it with:** "Is it true CSK won IPL in 2021?"

**Expected result:**
- ✅ Status: True
- ✅ Confidence: 90+
- ✅ Key facts with dates
- ✅ News sources
- ✅ No red flags

---

## 💡 Tips

1. **Start with DEBUG_ANALYSIS=true** to see detailed logs
2. **Monitor API quotas** especially GNews (100/day free)
3. **Try various queries** to understand the system
4. **Review AI responses** to ensure quality
5. **Adjust confidence thresholds** if needed

---

**Need help?** Check the documentation files or enable debug mode!

---

Last updated: Implementation complete ✨
