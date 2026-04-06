# GNews Data Logging Guide

## Overview

The GNews service now logs all raw data received from the API. This helps you see exactly what information is being fetched and sent to the AI for analysis.

## What Gets Logged

### 1. **Raw Response Data**
Every time GNews is queried, you'll see:

```
====================================
[GNEWS] Raw Response Data:
====================================
Query: "CSK IPL 2021"
Total Results: 10
Articles Returned: 3

--- Article 1 ---
Title: CSK beat KKR to win IPL 2021
Description: Chennai Super Kings defeated Kolkata Knight Riders...
Source: ESPN Cricinfo
URL: https://example.com/article1
Published: 2021-10-15T18:30:00Z
Image: https://example.com/image1.jpg
Content: Chennai Super Kings clinched their fourth IPL title...

--- Article 2 ---
...
====================================
```

### 2. **Final Summary**
After processing, you'll see:

```
====================================
[GNEWS] Final Results Summary:
====================================
Total unique articles collected: 3

Selected Articles for AI Analysis:
1. CSK beat KKR to win IPL 2021 (ESPN Cricinfo)
2. Chennai clinch fourth title (ICC)
3. MS Dhoni leads CSK to victory (Cricbuzz)
====================================
```

## How to View Logs

### Method 1: Run Test Script
```bash
cd backend
node test-gnews-logging.js
```

This will:
- Test multiple queries
- Show all raw GNews data
- Display the mapped data structure
- Wait between requests to avoid rate limits

### Method 2: Make API Request
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Is it true CSK won IPL in 2021?"}'
```

Check your backend console/terminal to see the logs.

### Method 3: Enable Debug Mode
In `.env`:
```env
DEBUG_ANALYSIS=true
```

This provides even more detailed logging.

## Data Structure

### Raw GNews Response
```javascript
{
  totalArticles: 100,        // Total matches found
  articles: [
    {
      title: "Article Title",
      description: "Article description text",
      content: "Full article content (first 150 chars)",
      url: "https://...",
      image: "https://...",
      publishedAt: "2021-10-15T18:30:00Z",
      source: {
        name: "Source Name",
        url: "https://..."
      }
    },
    // ... more articles
  ]
}
```

### Mapped Data (Sent to AI)
```javascript
{
  title: "Article Title",
  description: "Article description text",
  source: "Source Name",
  url: "https://..."
}
```

## What the AI Receives

The AI gets the claim + these articles:

```
Claim: "Is it true CSK won IPL in 2021?"

Evidence from news:

1. "CSK beat KKR to win IPL 2021"
   Source: ESPN Cricinfo
   Description: Chennai Super Kings defeated...

2. "Chennai clinch fourth title"
   Source: ICC
   Description: MS Dhoni led team...

3. "MS Dhoni leads CSK to victory"
   Source: Cricbuzz
   Description: Final held in Dubai...
```

## Understanding the Logs

### Query Processing
```
[GNEWS] Starting fetch for claim: "Is it true CSK won IPL in 2021?"
[GNEWS] Candidate queries: ["CSK IPL 2021", "CSK won IPL 2021", ...]
```
- Shows original claim
- Shows search query variations

### Article Details
```
Title: CSK beat KKR to win IPL 2021
Description: Chennai Super Kings defeated Kolkata...
Source: ESPN Cricinfo
URL: https://...
Published: 2021-10-15T18:30:00Z
```
- Full article metadata
- Publication date
- Source information
- Direct URL to article

### Selection Process
```
Total unique articles collected: 3

Selected Articles for AI Analysis:
1. CSK beat KKR to win IPL 2021 (ESPN Cricinfo)
2. Chennai clinch fourth title (ICC)
3. MS Dhoni leads CSK to victory (Cricbuzz)
```
- Shows which articles were selected
- Deduplicates by URL
- Top 3 most relevant

## Example Test Run

```bash
node test-gnews-logging.js
```

**Output:**
```
╔════════════════════════════════════════════════════╗
║       GNews Data Logging Test                      ║
╚════════════════════════════════════════════════════╝

✅ GNEWS_API_KEY found

================================================================================
🔍 Testing Query: "Is it true CSK won IPL in 2021?"
================================================================================

====================================
[GNEWS] Raw Response Data:
====================================
Query: "CSK IPL 2021"
Total Results: 10
Articles Returned: 3

--- Article 1 ---
Title: CSK beat KKR to win IPL 2021
Description: Chennai Super Kings defeated...
Source: ESPN Cricinfo
URL: https://example.com/1
Published: 2021-10-15T18:30:00Z
Image: https://example.com/img1.jpg
Content: Chennai Super Kings clinched...

[... more articles ...]

====================================
[GNEWS] Final Results Summary:
====================================
Total unique articles collected: 3
Selected Articles for AI Analysis:
1. CSK beat KKR to win IPL 2021 (ESPN Cricinfo)
====================================

📊 Result:
   Found 3 article(s)

   Mapped Data Structure:
   Article 1:
   {
     title: "CSK beat KKR to win IPL 2021",
     description: "Chennai Super Kings defeated...",
     source: "ESPN Cricinfo",
     url: "https://example.com/1"
   }
```

## Fields Explained

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Article headline | "CSK beat KKR to win IPL 2021" |
| `description` | Article summary/excerpt | "Chennai Super Kings defeated..." |
| `source.name` | News source name | "ESPN Cricinfo" |
| `url` | Direct link to article | "https://..." |
| `publishedAt` | Publication timestamp | "2021-10-15T18:30:00Z" |
| `image` | Article image URL | "https://..." |
| `content` | Article content preview | First 150 characters |

## Why This Is Useful

1. **Transparency**: See exactly what data the AI receives
2. **Debugging**: Verify GNews is returning relevant articles
3. **Quality Check**: Ensure sources are credible
4. **Rate Limiting**: Monitor API usage
5. **Understanding**: See how queries are optimized

## Logs Location

- **Console/Terminal**: Where you started the backend
- **Production**: Use logging service (Winston, Morgan, etc.)

## Tips

1. **Watch for relevance**: Are articles related to the claim?
2. **Check sources**: Are they credible news outlets?
3. **Verify dates**: Are articles recent and relevant?
4. **Monitor count**: Getting enough articles? (ideally 3)
5. **Rate limits**: Free tier = 100 requests/day

## Common Issues

### No Articles Found
```
Articles Returned: 0
No articles found
```
**Solutions:**
- Try more specific queries
- Check if topic is covered in news
- Verify API key is valid

### Rate Limit Exceeded
```
GNews unavailable (status 429)
```
**Solutions:**
- Wait until quota resets (midnight UTC)
- Upgrade to paid plan
- Cache frequently requested queries

### Low Quality Results
```
Articles don't match claim
```
**Solutions:**
- Query optimization may need tuning
- Try rephrasing the claim
- Some topics have limited coverage

## Next Steps

1. **Run test**: `node test-gnews-logging.js`
2. **Review logs**: Check article quality and relevance
3. **Test queries**: Try different types of claims
4. **Monitor usage**: Track API quota

---

**Logging is now enabled!** You'll see complete GNews data in your console. 📊
