require('dotenv').config();
const { analyzeFakeNews } = require('./services/fakeNewsService');

async function test() {
  console.log('Testing complete answer system...\n');
  
  const testQueries = [
    "Did CSK win IPL in 2021?",
    "Who won FIFA World Cup 2022?",
    "Did Mumbai Indians win IPL 2024?"
  ];

  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Question: ${query}`);
    console.log('='.repeat(60));
    
    const result = await analyzeFakeNews(query);
    
    if (result) {
      console.log(`\nStatus: ${result.status}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`\nAnswer:\n${result.explanation}`);
      
      if (result.ai_analysis?.key_facts?.length > 0) {
        console.log(`\nKey Facts:`);
        result.ai_analysis.key_facts.forEach(fact => {
          console.log(`  • ${fact}`);
        });
      }
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
}

test().catch(console.error);
