const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeNewsArticle(url) {
  try {
    console.log(`[SCRAPER] Fetching content from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirects: 3
    });

    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, .ad, .advertisement').remove();
    
    // Extract main content
    let content = '';
    const selectors = [
      'article',
      '[role="article"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      'main',
      '#content'
    ];
    
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length) {
        content = element.text().trim();
        break;
      }
    }
    
    // Fallback to body paragraphs
    if (!content) {
      content = $('p').map((i, el) => $(el).text()).get().join(' ');
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 2000); // Limit to first 2000 chars
    
    console.log(`[SCRAPER] ✅ Extracted ${content.length} characters`);
    
    return {
      url,
      content,
      title: $('title').text() || $('h1').first().text() || '',
    };
  } catch (error) {
    console.warn(`[SCRAPER] Failed to scrape ${url}: ${error.message}`);
    return null;
  }
}

async function scrapeMultipleUrls(urls, maxConcurrent = 3) {
  console.log(`\n[SCRAPER] Starting to scrape ${urls.length} URLs`);
  
  const results = [];
  
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(url => scrapeNewsArticle(url))
    );
    results.push(...batchResults.filter(Boolean));
  }
  
  console.log(`[SCRAPER] ✅ Successfully scraped ${results.length}/${urls.length} URLs\n`);
  
  return results;
}

module.exports = {
  scrapeNewsArticle,
  scrapeMultipleUrls,
};
