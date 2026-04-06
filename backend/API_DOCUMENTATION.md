# DeepTrust API Documentation

## Base URL
```
http://localhost:5000/api
```

## Endpoints

### 1. Health Check

Check if the backend is running.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "success": true,
  "message": "DeepTrust backend is running"
}
```

---

### 2. Analyze Text Claim

Verify a text claim using AI and real-time news sources.

**Endpoint:** `POST /api/analyze`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "Your claim to verify here"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Is it true CSK won IPL in 2021?"}'
```

**Response:**
```json
{
  "status": "True",
  "result": "Real",
  "confidence": 92,
  "explanation": "Chennai Super Kings (CSK) did win the IPL 2021 tournament. The final was held on October 15, 2021, in Dubai, where CSK defeated Kolkata Knight Riders by 27 runs. MS Dhoni captained the team to their 4th IPL title. Multiple credible sports sources including ESPN Cricinfo, ICC, and other major sports outlets reported this extensively.",
  "source_match": "strong",
  "sources": [
    {
      "title": "CSK beat KKR to win IPL 2021 title",
      "description": "Chennai Super Kings clinched their fourth IPL title...",
      "url": "https://example.com/article1",
      "source": "ESPN Cricinfo"
    }
  ],
  "source": "ai+gnews",
  "ai_analysis": {
    "key_facts": [
      "CSK won IPL 2021 on October 15, 2021",
      "They defeated Kolkata Knight Riders in the final",
      "Final score: CSK won by 27 runs",
      "MS Dhoni was the captain",
      "This was CSK's 4th IPL title"
    ],
    "red_flags": [],
    "sources_assessment": "Multiple credible sports news sources confirm this event. The specifics (date, opponent, margin) are consistent across sources."
  }
}
```

---

### 3. Analyze Image

Verify an image for deepfakes, manipulations, or inappropriate content.

**Endpoint:** `POST /api/analyze`

**Headers:**
```
Content-Type: multipart/form-data
```

**Request Body:**
```
image: <file upload>
text: <optional text claim>
```

**Example with cURL:**
```bash
curl -X POST http://localhost:5000/api/analyze \
  -F "image=@/path/to/image.jpg" \
  -F "text=Is this image real?"
```

---

## Response Fields

### Status Values

| Status | Description |
|--------|-------------|
| `True` | Verified as factually correct (confidence ≥75%) |
| `Likely True` | Probably true but with some uncertainty (60-74%) |
| `Unverified` | Cannot be confirmed with available evidence |
| `Likely Fake` | Probably false (60-74%) |
| `Fake` | Verified as false (confidence ≥75%) |
| `Misleading` | Contains misleading or deceptive elements |

### Result Values

| Result | Description |
|--------|-------------|
| `Real` | Content is verified as authentic |
| `Fake` | Content is verified as false or fake |
| `null` | Cannot determine (unverified) |

### Confidence Score

- **0-100**: Numerical confidence level
- **90-100**: Very high confidence
- **75-89**: High confidence
- **60-74**: Moderate confidence
- **40-59**: Low confidence
- **0-39**: Very low confidence

### Source Match

| Value | Description |
|-------|-------------|
| `strong` | Multiple relevant sources found (≥2 articles, good overlap) |
| `weak` | Limited sources or weak correlation (1 article or low overlap) |
| `none` | No relevant sources found |

### AI Analysis Object

```json
{
  "key_facts": [
    "List of verified facts extracted from analysis"
  ],
  "red_flags": [
    "List of concerning elements or warning signs"
  ],
  "sources_assessment": "Evaluation of source credibility and consistency"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "Provide text, an image upload, or both for analysis."
}
```

### 500 Internal Server Error
```json
{
  "message": "Error message describing what went wrong"
}
```

---

## Rate Limits

**GNews API (Free Tier):**
- 100 requests per day
- Resets at midnight UTC

**Puter.ai:**
- Depends on your plan
- Check https://puter.com/ for details

---

## Testing the API

### Using cURL

**1. Check health:**
```bash
curl http://localhost:5000/api/health
```

**2. Verify a claim:**
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Did Argentina win the 2022 FIFA World Cup?"}'
```

**3. Analyze with image:**
```bash
curl -X POST http://localhost:5000/api/analyze \
  -F "text=Is this image authentic?" \
  -F "image=@photo.jpg"
```

### Using JavaScript (Fetch API)

```javascript
const response = await fetch('http://localhost:5000/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Is it true CSK won IPL in 2021?'
  })
});

const result = await response.json();
console.log(result);
```

### Using Python (requests)

```python
import requests

response = requests.post(
    'http://localhost:5000/api/analyze',
    json={'text': 'Is it true CSK won IPL in 2021?'}
)

result = response.json()
print(result)
```

---

## Example Queries

### Sports Facts
```json
{"text": "Did India win Cricket World Cup 2023?"}
{"text": "Lionel Messi plays for Barcelona"}
{"text": "Tom Brady retired from NFL"}
```

### Current Events
```json
{"text": "Recent election results in [country]"}
{"text": "New policy announced by government yesterday"}
{"text": "Celebrity announced engagement on social media"}
```

### Science Claims
```json
{"text": "Scientists found cure for cancer"}
{"text": "New planet discovered in our solar system"}
{"text": "5G towers cause COVID-19"}
```

### Historical Facts
```json
{"text": "World War 2 ended in 1945"}
{"text": "Apollo 11 landed on the moon"}
{"text": "Taj Mahal was built by Shah Jahan"}
```

---

## Debug Mode

Enable detailed logging by setting in `.env`:
```env
DEBUG_ANALYSIS=true
```

This will log:
- GNews search queries
- Article matching scores
- AI analysis requests/responses
- Confidence calculations

---

## Support

For issues or questions:
1. Check `backend/ENHANCED_AI_README.md`
2. Verify API keys are configured correctly
3. Enable debug mode to see detailed logs
4. Check API rate limits haven't been exceeded

---

## Advanced Usage

### Custom Timeout

Modify `REQUEST_TIMEOUT_MS` in `services/gnewsService.js` (default: 10 seconds)

### Adjust Article Count

Modify `MAX_ARTICLES` in `services/gnewsService.js` (default: 3)

### Change AI Model

Modify model in `services/aiService.js`:
```javascript
model: "claude-3.5-sonnet"  // or other available models
```

### Temperature Control

Adjust AI creativity in `services/aiService.js`:
```javascript
temperature: 0.3  // Lower = more factual, Higher = more creative
```

---

## Security Notes

- Never commit `.env` file to version control
- Keep API keys secure and private
- Use environment variables for sensitive data
- Implement rate limiting in production
- Validate and sanitize all user inputs

---

## License

MIT
