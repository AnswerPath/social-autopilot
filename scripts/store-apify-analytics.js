/**
 * Script to manually store Apify analytics data
 * Usage: node scripts/store-apify-analytics.js <userId> [apifyData.json]
 * 
 * If apifyData.json is not provided, it will use the hardcoded data below
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Get Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Hardcoded Apify data from the user
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

/**
 * Calculate engagement rate (based on likes only, not requiring impressions)
 */
function calculateEngagementRate(likes, retweets, replies, impressions) {
  // Engagement rate is now based on likes only (average likes per post)
  // This allows calculation even when impressions are not available
  return Number(likes.toFixed(4));
}

/**
 * Transform Apify post data to analytics format
 */
function transformApifyData(posts, userId) {
  return posts.map((post) => {
    // Extract tweet ID from postId or postUrl
    const tweetId = String(post.postId || post.id || post.postUrl?.split('/').pop() || '').trim();
    
    if (!tweetId) {
      console.warn(`⚠️ Skipping post with no tweet ID:`, post);
      return null;
    }
    
    // Map Apify field names to analytics format
    const likes = post.favouriteCount || post.likes || 0;
    const retweets = post.repostCount || post.retweets || 0;
    const replies = post.replyCount || post.replies || 0;
    const quotes = post.quoteCount || post.quotes || 0;
    const impressions = post.impressions || null; // Apify data doesn't have impressions
    
    // Calculate engagement rate
    const engagementRate = calculateEngagementRate(likes, retweets, replies, impressions);
    
    return {
      post_id: null, // Will be set if we find a matching scheduled post
      tweet_id: tweetId,
      user_id: userId,
      likes: Number(likes) || 0,
      retweets: Number(retweets) || 0,
      replies: Number(replies) || 0,
      quotes: Number(quotes) || 0,
      impressions: impressions !== null && impressions !== undefined ? Number(impressions) : null,
      engagement_rate: engagementRate !== null ? engagementRate : null,
      reach: undefined,
      collected_at: new Date(),
    };
  }).filter(item => item !== null);
}

/**
 * Store analytics records
 */
async function storeAnalytics(analytics) {
  console.log(`💾 Storing ${analytics.length} analytics records...`);
  
  // Transform to database format
  const records = analytics.map((a) => {
    const tweetId = String(a.tweet_id || '');
    
    // Validate tweet ID
    if (!tweetId || tweetId.trim() === '') {
      return null;
    }
    
    const record = {
      user_id: String(a.user_id),
      post_id: tweetId, // post_id stores the tweet ID (TEXT)
      tweet_id: tweetId, // tweet_id also stores the tweet ID (TEXT)
      scheduled_post_id: null, // Will be set if we find a matching scheduled post
      likes: Number(a.likes) || 0,
      retweets: Number(a.retweets) || 0,
      replies: Number(a.replies) || 0,
      quotes: Number(a.quotes) || 0,
      impressions: a.impressions !== undefined && a.impressions !== null ? Number(a.impressions) : null,
      clicks: a.clicks !== undefined && a.clicks !== null ? Number(a.clicks) : null,
      engagement_rate: a.engagement_rate !== undefined && a.engagement_rate !== null ? Number(a.engagement_rate) : null,
      collected_at: a.collected_at.toISOString(),
    };
    
    return record;
  }).filter(r => r !== null);
  
  if (records.length === 0) {
    console.error('❌ No valid records to store');
    return { success: false, error: 'No valid records' };
  }
  
  console.log(`   Sample record:`, JSON.stringify(records[0], null, 2));
  
  // Try to link to scheduled posts
  const tweetIds = records.map(r => r.post_id);
  const { data: scheduledPosts, error: scheduledError } = await supabase
    .from('scheduled_posts')
    .select('id, posted_tweet_id')
    .in('posted_tweet_id', tweetIds);
  
  if (scheduledPosts && scheduledPosts.length > 0) {
    console.log(`   Found ${scheduledPosts.length} scheduled posts to link`);
    const tweetIdToPostId = new Map();
    scheduledPosts.forEach((post) => {
      if (post.posted_tweet_id) {
        const tweetIdStr = String(post.posted_tweet_id);
        tweetIdToPostId.set(tweetIdStr, post.id);
      }
    });
    
    // Update records with scheduled_post_id
    records.forEach((record) => {
      const scheduledPostId = tweetIdToPostId.get(record.post_id);
      if (scheduledPostId) {
        record.scheduled_post_id = scheduledPostId;
        console.log(`   Linked tweet ${record.post_id} to scheduled post ${scheduledPostId}`);
      }
    });
  }
  
  // Upsert records
  const { data, error } = await supabase
    .from('post_analytics')
    .upsert(records, {
      onConflict: 'user_id,post_id',
    })
    .select('id');
  
  if (error) {
    console.error(`   ❌ Error upserting analytics records:`, error);
    return {
      success: false,
      error: `Database error: ${error.message}`,
    };
  }
  
  console.log(`✅ Successfully stored ${data?.length || 0} analytics records`);
  return {
    success: true,
    count: data?.length || 0,
  };
}

/**
 * Main function
 */
async function main() {
  const userId = process.argv[2];
  const dataFile = process.argv[3];
  
  if (!userId) {
    console.error('❌ Usage: node scripts/store-apify-analytics.js <userId> [apifyData.json]');
    console.error('   Example: node scripts/store-apify-analytics.js db8c584a-3a6e-4301-a170-85b7faded354');
    process.exit(1);
  }
  
  let dataToStore = apifyData;
  
  // If data file is provided, read from it
  if (dataFile) {
    const fs = require('fs');
    const fileData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    dataToStore = fileData;
    console.log(`📄 Loaded ${dataToStore.length} posts from ${dataFile}`);
  } else {
    console.log(`📄 Using hardcoded data (${dataToStore.length} posts)`);
  }
  
  console.log(`👤 User ID: ${userId}`);
  console.log(`📊 Processing ${dataToStore.length} posts...`);
  
  // Transform data
  const analytics = transformApifyData(dataToStore, userId);
  console.log(`✅ Transformed ${analytics.length} posts to analytics format`);
  
  // Store analytics
  const result = await storeAnalytics(analytics);
  
  if (result.success) {
    console.log(`\n✅ Success! Stored ${result.count} analytics records`);
    process.exit(0);
  } else {
    console.error(`\n❌ Failed to store analytics: ${result.error}`);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

