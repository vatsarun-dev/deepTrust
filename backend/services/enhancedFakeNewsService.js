const { fetchRelevantNews } = require("./gnewsService");
const { fetchWikipediaInfo } = require("./wikipediaService");
const { searchGoogle, searchFactCheckSites } = require("./googleSearchService");
const { scrapeMultipleUrls } = require("./webScraperService");
const {
  analyzeWithAI,
  mapVerdictToStatus,
  mapVerdictToResult,
} = require("./aiService");

function mapSources(articles) {
  return articles.slice(0, 5).map((article) => ({
    title: String(article?.title || "").trim(),
    description: String(article?.description || article?.snippet || "").trim(),
    url: String(article?.url || "").trim(),
    source: String(article?.source || article?.source?.name || "Unknown").trim(),
  }));
}

async function gatherAllSources(claimText) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[MULTI-SOURCE] Gathering evidence from all sources`);
  console.log('='.repeat(70));

  const sourcePromises = [];

  // 1. GNews API
  sourcePromises.push(
    fetchRelevantNews(claimText)
      .then(articles => ({ source: 'GNews', articles }))
      .catch(err => {
        console.warn(`[MULTI-SOURCE] GNews failed: ${err.message}`);
        return { source: 'GNews', articles: [] };
      })
  );

  // 2. Wikipedia
  sourcePromises.push(
    fetchWikipediaInfo(claimText)
      .then(articles => ({ source: 'Wikipedia', articles }))
      .catch(err => {
        console.warn(`[MULTI-SOURCE] Wikipedia failed: ${err.message}`);
        return { source: 'Wikipedia', articles: [] };
      })
  );

  // 3. Google Search
  sourcePromises.push(
    searchGoogle(claimText, 5)
      .then(articles => ({ source: 'Google', articles }))
      .catch(err => {
        console.warn(`[MULTI-SOURCE] Google failed: ${err.message}`);
        return { source: 'Google', articles: [] };
      })
  );

  // 4. Fact-Check Sites
  sourcePromises.push(
    searchFactCheckSites(claimText)
      .then(articles => ({ source: 'FactCheck', articles }))
      .catch(err => {
        console.warn(`[MULTI-SOURCE] FactCheck failed: ${err.message}`);
        return { source: 'FactCheck', articles: [] };
      })
  );

  const results = await Promise.all(sourcePromises);

  console.log(`\n[MULTI-SOURCE] Results Summary:`);
  console.log('─'.repeat(70));
  
  const allArticles = [];
  const seenUrls = new Set();
  
  for (const result of results) {
    console.log(`${result.source}: ${result.articles.length} articles`);
    
    // Deduplicate by URL
    for (const article of result.articles) {
      const url = article.url || '';
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        allArticles.push({
          ...article,
          sourceType: result.source,
        });
      }
    }
  }

  console.log(`\nTotal Unique Articles: ${allArticles.length}`);
  console.log('─'.repeat(70));

  // Optional: Scrape top articles for deeper content
  const topUrls = allArticles
    .filter(a => a.url && !a.url.includes('wikipedia'))
    .slice(0, 5)
    .map(a => a.url);

  if (topUrls.length > 0) {
    console.log(`\n[MULTI-SOURCE] Scraping ${topUrls.length} articles for full content...`);
    const scrapedContent = await scrapeMultipleUrls(topUrls);
    
    // Merge scraped content back into articles
    scrapedContent.forEach(scraped => {
      const article = allArticles.find(a => a.url === scraped.url);
      if (article) {
        article.fullContent = scraped.content;
      }
    });
  }

  console.log('='.repeat(70) + '\n');

  return allArticles;
}

async function analyzeWithMultipleSources(claimText) {
  const normalizedText = String(claimText || "").trim();
  if (!normalizedText) {
    return null;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`[ENHANCED-ANALYSIS] Processing claim: "${normalizedText}"`);
  console.log('='.repeat(80));

  // Step 1: Gather from all sources
  const allArticles = await gatherAllSources(normalizedText);

  if (allArticles.length === 0) {
    console.log(`\n[ENHANCED-ANALYSIS] ⚠️  No articles found from any source`);
  } else {
    console.log(`\n[ENHANCED-ANALYSIS] 📰 Found ${allArticles.length} total articles`);
    console.log('─'.repeat(80));
    
    // Group by source type
    const grouped = {};
    allArticles.forEach(article => {
      const type = article.sourceType || 'Other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(article);
    });

    Object.keys(grouped).forEach(sourceType => {
      console.log(`\n${sourceType} (${grouped[sourceType].length} articles):`);
      grouped[sourceType].slice(0, 3).forEach((article, idx) => {
        console.log(`  ${idx + 1}. ${article.title || 'Untitled'}`);
        console.log(`     ${article.source || 'Unknown source'}`);
      });
    });
    console.log('─'.repeat(80));
  }

  // Step 2: Prepare articles for AI - prioritize fact-check sites and include full content
  const articlesForAI = allArticles
    .sort((a, b) => {
      // Prioritize fact-check sites
      if (a.sourceType === 'FactCheck' && b.sourceType !== 'FactCheck') return -1;
      if (b.sourceType === 'FactCheck' && a.sourceType !== 'FactCheck') return 1;
      return 0;
    })
    .slice(0, 8) // Increased from 3 to 8 articles
    .map(article => ({
      title: article.title,
      description: article.description || article.snippet || article.fullContent?.substring(0, 300) || '',
      source: `${article.source} (via ${article.sourceType})`,
      url: article.url,
    }));

  // Step 3: AI Analysis with enhanced context
  let aiAnalysis = null;
  try {
    console.log(`\n[ENHANCED-ANALYSIS] 🤖 Analyzing with AI (${articlesForAI.length} sources)...`);
    aiAnalysis = await analyzeWithAI(normalizedText, articlesForAI);
    
    if (aiAnalysis) {
      console.log(`[ENHANCED-ANALYSIS] ✅ AI Verdict: ${aiAnalysis.verdict}`);
      console.log(`[ENHANCED-ANALYSIS] ✅ Confidence: ${aiAnalysis.confidence}%`);
      console.log(`[ENHANCED-ANALYSIS] ✅ Key Facts: ${aiAnalysis.keyFacts?.length || 0}`);
    }
  } catch (error) {
    console.error(`\n[ENHANCED-ANALYSIS] ❌ AI failed: ${error.message}`);
  }

  // Step 4: Build comprehensive result
  if (aiAnalysis) {
    let fakePercentage;
    if (aiAnalysis.verdict === "TRUE") {
      fakePercentage = 100 - aiAnalysis.confidence;
    } else if (aiAnalysis.verdict === "FALSE") {
      fakePercentage = aiAnalysis.confidence;
    } else if (aiAnalysis.verdict === "MISLEADING") {
      fakePercentage = Math.max(60, aiAnalysis.confidence);
    } else {
      fakePercentage = 50;
    }

    const sourceBreakdown = {};
    allArticles.forEach(article => {
      const type = article.sourceType || 'Other';
      sourceBreakdown[type] = (sourceBreakdown[type] || 0) + 1;
    });

    console.log(`\n[ENHANCED-ANALYSIS] 📊 Final Result:`);
    console.log(`  Verdict: ${aiAnalysis.verdict}`);
    console.log(`  Status: ${mapVerdictToStatus(aiAnalysis.verdict, aiAnalysis.confidence)}`);
    console.log(`  Fake Probability: ${fakePercentage}%`);
    console.log(`  Sources Used: ${Object.keys(sourceBreakdown).join(', ')}`);
    console.log('='.repeat(80) + '\n');

    return {
      status: mapVerdictToStatus(aiAnalysis.verdict, aiAnalysis.confidence),
      result: mapVerdictToResult(aiAnalysis.verdict),
      confidence: fakePercentage,
      explanation: aiAnalysis.reasoning,
      source_match: allArticles.length >= 5 ? "strong" : allArticles.length >= 2 ? "moderate" : "weak",
      sources: mapSources(allArticles),
      source: 'multi-source-ai',
      articles_found: allArticles.length,
      source_breakdown: sourceBreakdown,
      ai_analysis: {
        key_facts: aiAnalysis.keyFacts,
        red_flags: aiAnalysis.redFlags,
        sources_assessment: aiAnalysis.sourcesAssessment,
      },
    };
  }

  // Fallback if AI fails
  console.log(`\n[ENHANCED-ANALYSIS] ⚠️  AI unavailable, returning fallback`);
  console.log('='.repeat(80) + '\n');

  return {
    status: "Unverified",
    result: null,
    confidence: 50,
    explanation: `Found ${allArticles.length} sources but AI analysis is currently unavailable. Please check the sources manually.`,
    source_match: allArticles.length > 0 ? "weak" : "none",
    sources: mapSources(allArticles),
    source: 'multi-source-only',
    articles_found: allArticles.length,
  };
}

module.exports = {
  analyzeWithMultipleSources,
  gatherAllSources,
};
