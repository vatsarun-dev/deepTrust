const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

async function searchWikipedia(query) {
  try {
    const searchParams = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      format: "json",
      srlimit: "3",
      origin: "*"
    });

    console.log(`\n[WIKIPEDIA] Searching for: "${query}"`);
    
    const response = await fetch(`${WIKIPEDIA_API_URL}?${searchParams.toString()}`);
    const data = await response.json();

    if (!data.query || !data.query.search) {
      console.log(`[WIKIPEDIA] No results found`);
      return [];
    }

    console.log(`[WIKIPEDIA] Found ${data.query.search.length} results`);
    return data.query.search;
  } catch (error) {
    console.error(`[WIKIPEDIA] Search failed: ${error.message}`);
    return [];
  }
}

async function getPageContent(pageId) {
  try {
    const params = new URLSearchParams({
      action: "query",
      pageids: pageId,
      prop: "extracts",
      exintro: "true",
      explaintext: "true",
      format: "json",
      origin: "*"
    });

    const response = await fetch(`${WIKIPEDIA_API_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.query && data.query.pages && data.query.pages[pageId]) {
      return data.query.pages[pageId].extract || "";
    }
    return "";
  } catch (error) {
    console.error(`[WIKIPEDIA] Failed to get content: ${error.message}`);
    return "";
  }
}

async function fetchWikipediaInfo(query) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[WIKIPEDIA] Fetching information for: "${query}"`);
  console.log('='.repeat(70));

  const searchResults = await searchWikipedia(query);

  if (searchResults.length === 0) {
    console.log(`\n[WIKIPEDIA] ❌ No results found\n`);
    return [];
  }

  const articles = [];

  for (const result of searchResults) {
    console.log(`\n[WIKIPEDIA] Getting content for: "${result.title}"`);
    
    const content = await getPageContent(result.pageid);
    
    const article = {
      title: result.title,
      snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
      content: content.substring(0, 500), // First 500 chars
      url: `https://en.wikipedia.org/?curid=${result.pageid}`,
      source: "Wikipedia",
      pageId: result.pageid
    };

    articles.push(article);

    console.log(`\n📄 ARTICLE ${articles.length}:`);
    console.log(`─`.repeat(70));
    console.log(`TITLE: ${article.title}`);
    console.log(`SNIPPET: ${article.snippet.substring(0, 150)}...`);
    console.log(`CONTENT: ${article.content.substring(0, 200)}...`);
    console.log(`URL: ${article.url}`);
    console.log(`─`.repeat(70));
  }

  console.log(`\n[WIKIPEDIA] ✅ Retrieved ${articles.length} articles`);
  console.log('='.repeat(70) + '\n');

  return articles;
}

module.exports = {
  fetchWikipediaInfo,
};
