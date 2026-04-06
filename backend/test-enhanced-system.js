const { analyzeImage } = require("./services/enhancedImageDetectionService");
const { analyzeWithMultipleSources } = require("./services/enhancedFakeNewsService");
const fs = require("fs");
const path = require("path");

async function testImageDetection() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TESTING ENHANCED IMAGE DETECTION");
  console.log("=".repeat(80));

  // Test with a mock image buffer
  const mockImage = {
    buffer: Buffer.from("fake-image-data"),
    originalname: "test-image.jpg",
    mimetype: "image/jpeg"
  };

  try {
    const result = await analyzeImage(mockImage);
    
    console.log("\n✅ Image Detection Test Results:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result && result.status) {
      console.log("\n✅ Image detection is working!");
      return true;
    } else {
      console.log("\n❌ Image detection returned invalid result");
      return false;
    }
  } catch (error) {
    console.error("\n❌ Image Detection Failed:");
    console.error(error.message);
    
    if (error.message.includes("Sightengine")) {
      console.log("\n⚠️  Check your SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in .env");
    }
    if (error.message.includes("PUTER")) {
      console.log("\n⚠️  Check your PUTER_API_TOKEN in .env");
    }
    
    return false;
  }
}

async function testNewsVerification() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TESTING ENHANCED NEWS VERIFICATION");
  console.log("=".repeat(80));

  const testClaim = "Did CSK win IPL 2021?";

  try {
    const result = await analyzeWithMultipleSources(testClaim);
    
    console.log("\n✅ News Verification Test Results:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result && result.status) {
      console.log("\n✅ News verification is working!");
      console.log(`   Found ${result.articles_found || 0} articles`);
      console.log(`   Source breakdown:`, result.source_breakdown);
      return true;
    } else {
      console.log("\n❌ News verification returned invalid result");
      return false;
    }
  } catch (error) {
    console.error("\n❌ News Verification Failed:");
    console.error(error.message);
    
    if (error.message.includes("GNEWS")) {
      console.log("\n⚠️  Check your GNEWS_API_KEY in .env");
    }
    if (error.message.includes("PUTER")) {
      console.log("\n⚠️  Check your PUTER_API_TOKEN in .env");
    }
    
    return false;
  }
}

async function checkConfiguration() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 CHECKING CONFIGURATION");
  console.log("=".repeat(80));

  const required = {
    "GNEWS_API_KEY": process.env.GNEWS_API_KEY,
    "PUTER_API_TOKEN": process.env.PUTER_API_TOKEN,
    "SIGHTENGINE_API_USER": process.env.SIGHTENGINE_API_USER,
    "SIGHTENGINE_API_SECRET": process.env.SIGHTENGINE_API_SECRET,
  };

  const optional = {
    "GOOGLE_SEARCH_API_KEY": process.env.GOOGLE_SEARCH_API_KEY,
    "GOOGLE_SEARCH_ENGINE_ID": process.env.GOOGLE_SEARCH_ENGINE_ID,
  };

  console.log("\n📋 Required Configuration:");
  let allRequired = true;
  for (const [key, value] of Object.entries(required)) {
    const status = value ? "✅" : "❌";
    console.log(`  ${status} ${key}: ${value ? "SET" : "MISSING"}`);
    if (!value) allRequired = false;
  }

  console.log("\n📋 Optional Configuration (for enhanced features):");
  for (const [key, value] of Object.entries(optional)) {
    const status = value ? "✅" : "⚠️ ";
    console.log(`  ${status} ${key}: ${value ? "SET" : "NOT SET"}`);
  }

  if (!allRequired) {
    console.log("\n❌ Some required API keys are missing!");
    console.log("   Please check your .env file");
    return false;
  }

  console.log("\n✅ All required configuration present!");
  return true;
}

async function runAllTests() {
  require("dotenv").config();

  console.log("\n");
  console.log("╔" + "=".repeat(78) + "╗");
  console.log("║" + " ".repeat(20) + "DEEPTRUST ENHANCED SYSTEM TEST" + " ".repeat(27) + "║");
  console.log("╚" + "=".repeat(78) + "╝");

  const configOk = await checkConfiguration();
  
  if (!configOk) {
    console.log("\n⚠️  Configuration incomplete. Please fix .env file first.");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(80));
  console.log("Starting tests...");
  console.log("=".repeat(80));

  const results = {
    image: false,
    news: false
  };

  // Test Image Detection
  results.image = await testImageDetection();

  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test News Verification
  results.news = await testNewsVerification();

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));
  console.log(`\n  Image Detection: ${results.image ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  News Verification: ${results.news ? "✅ PASS" : "❌ FAIL"}`);

  if (results.image && results.news) {
    console.log("\n🎉 All tests passed! Your enhanced DeepTrust is ready!");
  } else {
    console.log("\n⚠️  Some tests failed. Check the errors above.");
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

// Run tests
runAllTests().catch(error => {
  console.error("\n❌ Test suite failed:");
  console.error(error);
  process.exit(1);
});
