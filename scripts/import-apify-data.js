/**
 * Script to import Apify data via the API endpoint
 * Usage: node scripts/import-apify-data.js <userId> [apifyData.json]
 */

const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Hardcoded Apify data
const apifyData = [
  {
    "postUrl": "https://x.com/s925667/status/2000366339811381279",
    "profileUrl": "https://x.com/s925667",
    "postId": "2000366339811381279",
    "postText": "🚨 IBM CEO says today's AI hype might be overblown — estimating just a 0.1% chance of AGI and warning that trillion-dollar bets won't pay off without real profits.💸\n\nIs the AI gold rush finally meeting reality or are we just getting started? 🤖🔥 #AI #TechNews #BusinessInsights",
    "timestamp": 1765759475000,
    "conversationId": "2000366339811381279",
    "media": [],
    "author": {
      "name": "Lane Stoeger",
      "screenName": "s925667",
      "followersCount": 2,
      "favouritesCount": 0,
      "friendsCount": 4,
      "description": ""
    },
    "replyCount": 0,
    "quoteCount": 0,
    "favouriteCount": 0
  },
  {
    "postUrl": "https://x.com/s925667/status/1956573146800074981",
    "profileUrl": "https://x.com/s925667",
    "postId": "1956573146800074981",
    "postText": "As we shift from UX to AX in web design, AI agents will enhance our digital experiences like never before. Imagine personalized interactions that anticipate user needs! Is your business ready for this transformation? #UXtoAX #AIDesign @AI_Solutions… https://t.co/axM2iKCYHh",
    "timestamp": 1755318364000,
    "conversationId": "1956573146800074981",
    "media": [],
    "author": {
      "name": "Lane Stoeger",
      "screenName": "s925667",
      "followersCount": 2,
      "favouritesCount": 0,
      "friendsCount": 4,
      "description": ""
    },
    "replyCount": 0,
    "quoteCount": 0,
    "favouriteCount": 1
  },
  {
    "postUrl": "https://x.com/s925667/status/1955833555612844235",
    "profileUrl": "https://x.com/s925667",
    "postId": "1955833555612844235",
    "postText": "🔍 The new Nvidia &amp; AMD deal allowing AI chip sales to China raises eyebrows! 🚨 15% of revenue to the U.S. could redefine tech diplomacy. Are we entering a new era of 'regulated innovation'? #PolicyWatch #Geopolitics #TechDiplomacy @TechCrunch @CNBC —… https://t.co/i0B6b69tdV",
    "timestamp": 1755142031000,
    "conversationId": "1955833555612844235",
    "media": [],
    "author": {
      "name": "Lane Stoeger",
      "screenName": "s925667",
      "followersCount": 2,
      "favouritesCount": 0,
      "friendsCount": 4,
      "description": ""
    },
    "replyCount": 0,
    "quoteCount": 0,
    "favouriteCount": 0
  },
  {
    "postUrl": "https://x.com/s925667/status/1955811697463038210",
    "profileUrl": "https://x.com/s925667",
    "postId": "1955811697463038210",
    "postText": "As AI transforms workplaces, unions demand human oversight to ensure fair labor rights. Could 2025 be the year we see real change in how AI is managed? #LaborRights #AIEthics #TechPolicy @LaborUnion @TechPolicyExpert — ETUC calls for human oversight on… https://t.co/x3xlDfGOe9",
    "timestamp": 1755136820000,
    "conversationId": "1955811697463038210",
    "media": [],
    "author": {
      "name": "Lane Stoeger",
      "screenName": "s925667",
      "followersCount": 2,
      "favouritesCount": 0,
      "friendsCount": 4,
      "description": ""
    },
    "replyCount": 0,
    "quoteCount": 0,
    "favouriteCount": 0
  }
];

async function importData() {
  const userId = process.argv[2];
  const dataFile = process.argv[3];
  
  if (!userId) {
    console.error('❌ Usage: node scripts/import-apify-data.js <userId> [apifyData.json]');
    console.error('   Example: node scripts/import-apify-data.js db8c584a-3a6e-4301-a170-85b7faded354');
    process.exit(1);
  }
  
  let dataToImport = apifyData;
  
  // If data file is provided, read from it
  if (dataFile) {
    try {
      const fileContent = fs.readFileSync(dataFile, 'utf8');
      dataToImport = JSON.parse(fileContent);
      console.log(`📄 Loaded ${dataToImport.length} posts from ${dataFile}`);
    } catch (error) {
      console.error(`❌ Error reading file ${dataFile}:`, error);
      process.exit(1);
    }
  } else {
    console.log(`📄 Using hardcoded data (${dataToImport.length} posts)`);
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/analytics/posts/manual`;
  
  console.log(`👤 User ID: ${userId}`);
  console.log(`📊 Importing ${dataToImport.length} posts...`);
  console.log(`🌐 Sending to: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ posts: dataToImport }),
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`\n✅ Success! Stored ${result.stored || result.count} analytics records`);
      console.log(`   Message: ${result.message}`);
      process.exit(0);
    } else {
      console.error(`\n❌ Failed to import data:`);
      console.error(`   Error: ${result.error || 'Unknown error'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Network error:`, error.message);
    console.error(`   Make sure your app is running at ${baseUrl}`);
    process.exit(1);
  }
}

importData();

