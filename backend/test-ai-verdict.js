require('dotenv').config();
const { analyzeFakeNews } = require('./services/fakeNewsService');

async function quickTest() {
  console.log('\n' + '='.repeat(70));
  console.log('TESTING: AI generates verdict using articles as evidence');
  console.log('='.repeat(70) + '\n');

  if (!process.env.PUTER_API_TOKEN) {
    console.error('❌ PUTER_API_TOKEN not found in .env');
    console.log('\nAdd this to your .env file:');
    console.log('PUTER_API_TOKEN=your_token_here\n');
    return;
  }

  console.log('✅ PUTER_API_TOKEN configured\n');

  const query = "Did CSK win IPL in 2021?";
  
  console.log(`📝 Query: "${query}"\n`);
  console.log('Processing...\n');

  const result = await analyzeFakeNews(query);

  if (result) {
    console.log('\n' + '='.repeat(70));
    console.log('FINAL VERDICT (sent to frontend):');
    console.log('='.repeat(70));
    console.log(`\nStatus: ${result.status}`);
    console.log(`Result: ${result.result}`);
    console.log(`Confidence: ${result.confidence}%`);
    console.log(`Source: ${result.source}`);
    console.log(`Articles Found: ${result.articles_found || 0}`);
    
    console.log(`\n📋 Complete Answer:\n${result.explanation}`);
    
    if (result.ai_analysis?.key_facts?.length > 0) {
      console.log(`\n✅ Key Facts:`);
      result.ai_analysis.key_facts.forEach(fact => {
        console.log(`   • ${fact}`);
      });
    }

    if (result.ai_analysis?.red_flags?.length > 0) {
      console.log(`\n🚩 Red Flags:`);
      result.ai_analysis.red_flags.forEach(flag => {
        console.log(`   • ${flag}`);
      });
    }

    if (result.sources?.length > 0) {
      console.log(`\n📰 Supporting Articles:`);
      result.sources.forEach((src, i) => {
        console.log(`   ${i + 1}. ${src.title} (${src.source})`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ This complete report is sent to your frontend!');
    console.log('='.repeat(70) + '\n');
  } else {
    console.log('❌ No result returned\n');
  }
}

quickTest().catch(console.error);
