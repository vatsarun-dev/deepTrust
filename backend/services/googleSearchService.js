const axios = require("axios");

const GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

async function searchGoogle(query, limit = 5) {
  try {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      console.warn("[GOOGLE] API credentials not configured, skipping Google search");
      return [];
    }

    console.log(`\n[GOOGLE] Searching for: "${query}"`);

    const response = await axios.get(GOOGLE_SEARCH_URL, {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: query,
        num: Math.min(limit, 10),
      },
      timeout: 10000,
    });

    if (!response.data || !response.data.items) {
      console.log(`[GOOGLE] No results found`);
      return [];
    }

    const results = response.data.items.map((item) => ({
      title: item.title || "",
      description: item.snippet || "",
      url: item.link || "",
      source: item.displayLink || "Google Search",
    }));

    console.log(`[GOOGLE] ✅ Found ${results.length} results`);
    return results;
  } catch (error) {
    console.warn(`[GOOGLE] Search failed: ${error.message}`);
    return [];
  }
}

async function searchFactCheckSites(query) {
  const factCheckSites = [
    'site:snopes.com',
    'site:factcheck.org',
    'site:politifact.com',
    'site:apnews.com/APFactCheck',
    'site:reuters.com/fact-check'
  ];

  const searches = factCheckSites.map(site => 
    searchGoogle(`${query} ${site}`, 2)
  );

  try {
    const results = await Promise.all(searches);
    const combined = results.flat().filter(Boolean);
    
    console.log(`[GOOGLE-FACTCHECK] Found ${combined.length} fact-check results`);
    return combined;
  } catch (error) {
    console.warn(`[GOOGLE-FACTCHECK] Failed: ${error.message}`);
    return [];
  }
}

module.exports = {
  searchGoogle,
  searchFactCheckSites,
};
