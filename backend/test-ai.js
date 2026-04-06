const { analyzeWithAI, buildAdvancedPrompt } = require('./services/aiService');
const { fetchRelevantNews } = require('./services/gnewsService');

// Test examples
const testClaims = [
  "Is it true CSK won IPL in 2021?",
  "Did Argentina win FIFA World Cup 2022?",
  "The Earth is flat and NASA is hiding the truth",
  "Scientists found cure for all types of cancer in 2024"
];

async function runTests() {
  console.log('🧪 Testing DeepTrust Enhanced AI System\n');
  console.log('=' .repeat(60));
  
  for (const claim of testClaims) {
    console.log(`\n📝 Claim: "${claim}"\n`);
    
    try {
      // Step 1: Fetch news
      console.log('🔍 Fetching relevant news...');
      const articles = await fetchRelevantNews(claim);
      console.log(`   Found ${articles.length} article(s)\n`);
      
      if (articles.length > 0) {
        articles.slice(0, 2).forEach((article, idx) => {
          console.log(`   ${idx + 1}. ${article.title}`);
          console.log(`      Source: ${article.source}`);
        });
        console.log();
      }
      
      // Step 2: AI Analysis
      console.log('🤖 Running AI analysis...');
      const aiResult = await analyzeWithAI(claim, articles);
      
      if (aiResult) {
        console.log(`   Verdict: ${aiResult.verdict}`);
        console.log(`   Confidence: ${aiResult.confidence}%`);
        console.log(`   Reasoning: ${aiResult.reasoning.substring(0, 150)}...`);
        
        if (aiResult.keyFacts.length > 0) {
          console.log(`\n   ✅ Key Facts:`);
          aiResult.keyFacts.forEach(fact => console.log(`      - ${fact}`));
        }
        
        if (aiResult.redFlags.length > 0) {
          console.log(`\n   🚩 Red Flags:`);
          aiResult.redFlags.forEach(flag => console.log(`      - ${flag}`));
        }
      } else {
        console.log('   ⚠️  AI analysis not available (check PUTER_API_TOKEN)');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('\n' + '=' .repeat(60));
  }
  
  console.log('\n✨ Testing complete!\n');
}

// Check environment
console.log('🔧 Environment Check:');
console.log(`   GNEWS_API_KEY: ${process.env.GNEWS_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   PUTER_API_TOKEN: ${process.env.PUTER_API_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log();

// Run if GNEWS is configured
if (process.env.GNEWS_API_KEY) {
  runTests().catch(console.error);
} else {
  console.log('⚠️  Please configure GNEWS_API_KEY in .env to run tests');
  console.log('   Get your free API key at: https://gnews.io/\n');
}
