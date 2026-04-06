// Test GNews Data Logging
// This script shows you exactly what data GNews returns

require('dotenv').config();
const { fetchRelevantNews } = require('./services/gnewsService');

const testQueries = [
  "Is it true CSK won IPL in 2021?",
  "Did Argentina win FIFA World Cup 2022?",
  "NASA discovered aliens on Mars"
];

async function testGNewsLogging() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║       GNews Data Logging Test                      ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  if (!process.env.GNEWS_API_KEY) {
    console.error('❌ GNEWS_API_KEY not found in .env file');
    console.log('\nPlease add your GNews API key to .env:');
    console.log('GNEWS_API_KEY=your_key_here\n');
    return;
  }

  console.log('✅ GNEWS_API_KEY found\n');

  for (const query of testQueries) {
    console.log('\n' + '='.repeat(80));
    console.log(`🔍 Testing Query: "${query}"`);
    console.log('='.repeat(80));

    try {
      const articles = await fetchRelevantNews(query);
      
      console.log('\n📊 Result:');
      console.log(`   Found ${articles.length} article(s)`);
      
      if (articles.length > 0) {
        console.log('\n   Mapped Data Structure:');
        articles.forEach((article, idx) => {
          console.log(`\n   Article ${idx + 1}:`);
          console.log(`   {`);
          console.log(`     title: "${article.title}",`);
          console.log(`     description: "${article.description}",`);
          console.log(`     source: "${article.source}",`);
          console.log(`     url: "${article.url}"`);
          console.log(`   }`);
        });
      }

      // Wait 2 seconds between requests to avoid rate limiting
      if (testQueries.indexOf(query) < testQueries.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next request...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ Test Complete!');
  console.log('='.repeat(80));
  console.log('\nNotes:');
  console.log('- All raw GNews data is logged above');
  console.log('- Check the detailed article information');
  console.log('- This data is what gets sent to the AI for analysis');
  console.log('- Free tier limit: 100 requests/day\n');
}

// Run the test
testGNewsLogging().catch(console.error);
