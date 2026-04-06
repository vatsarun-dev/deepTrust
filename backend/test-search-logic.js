// Quick test of improved search logic
const gnewsService = require('./services/gnewsService');

const testQueries = [
  "Is that true CSK won IPL in 2025",
  "Did Argentina win FIFA World Cup 2022?",
  "Mumbai Indians won IPL 2024"
];

console.log('Testing improved search query building:\n');

// We'll manually test the logic
testQueries.forEach(query => {
  console.log(`Input: "${query}"`);
  
  // Simulate keyword extraction
  const normalized = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter(w => w.length >= 3);
  
  const stopWords = ["this", "that", "with", "from", "have", "will", "your", "about", 
                     "there", "their", "which", "would", "could", "should", "after",
                     "before", "where", "when", "what", "these", "those", "into",
                     "than", "been", "being", "also", "just", "only", "very",
                     "because", "claim", "article", "post", "news", "true", "false",
                     "real", "fake", "that", "did", "does", "was", "were"];
  
  const keywords = words.filter(w => !stopWords.includes(w));
  
  console.log(`Keywords: ${keywords.join(', ')}`);
  console.log(`Best query: ${keywords.slice(0, 5).join(' ')}`);
  console.log('---\n');
});

console.log('\nNow run: node test-gnews-logging.js\n');
