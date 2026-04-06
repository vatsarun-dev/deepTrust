require('dotenv').config();
const { analyzeFakeNews } = require('./services/fakeNewsService');

async function testAccuracy() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     TESTING FAKE PERCENTAGE (Lower % = More TRUE)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!process.env.PUTER_API_TOKEN) {
    console.error('❌ PUTER_API_TOKEN not configured in .env\n');
    return;
  }

  const tests = [
    {
      query: "Is that true CSK won IPL in 2021?",
      expected: "2-5% fake (it's TRUE)",
      shouldBe: "low"
    },
    {
      query: "Did Argentina win FIFA World Cup 2022?",
      expected: "2-5% fake (it's TRUE)",
      shouldBe: "low"
    },
    {
      query: "The Earth is flat",
      expected: "95-98% fake (it's FALSE)",
      shouldBe: "high"
    }
  ];

  for (const test of tests) {
    console.log('\n' + '─'.repeat(70));
    console.log(`📝 Query: "${test.query}"`);
    console.log(`✅ Expected: ${test.expected}`);
    console.log('─'.repeat(70));

    const result = await analyzeFakeNews(test.query);

    if (result) {
      console.log(`\n🎯 RESULT:`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Verdict: ${result.result}`);
      console.log(`   FAKE %: ${result.confidence}% 🎯`);
      console.log(`   Source: ${result.source}`);
      
      let passOrFail;
      if (test.shouldBe === "low") {
        passOrFail = result.confidence <= 10 ? "✅ PASS" : "❌ FAIL";
      } else {
        passOrFail = result.confidence >= 90 ? "✅ PASS" : "❌ FAIL";
      }
      console.log(`\n   ${passOrFail} - ${result.confidence}% fake`);

      console.log(`\n📋 Explanation:`);
      console.log(`   ${result.explanation.substring(0, 200)}...`);

      if (result.ai_analysis?.key_facts?.length > 0) {
        console.log(`\n✨ Key Facts:`);
        result.ai_analysis.key_facts.slice(0, 3).forEach(fact => {
          console.log(`   • ${fact}`);
        });
      }
      
      console.log(`\n   💡 Interpretation: ${result.confidence}% fake = ${100 - result.confidence}% true`);
    } else {
      console.log('\n❌ No result returned');
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('Testing complete!');
  console.log('\n📊 Remember: Lower % = More TRUE, Higher % = More FALSE');
  console.log('═'.repeat(70) + '\n');
}

testAccuracy().catch(console.error);
