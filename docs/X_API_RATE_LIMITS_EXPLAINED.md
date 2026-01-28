# X API Rate Limits Explained - Why You're Getting 429 Errors

## The Problem

You're seeing 429 (Rate Limit Exceeded) errors when trying to fetch analytics, even though your X API dashboard shows "8/100 posts" used. This is confusing because it seems like you have plenty of quota left.

## The Root Cause

**The "8/100 posts" limit is for POST endpoints (creating tweets), NOT for GET endpoints (fetching analytics).**

X API has **separate rate limit buckets** for different types of endpoints:

### POST Endpoints (Creating Tweets)
- **Limit**: 50-100 posts per day (depending on your plan)
- **What you see**: "8/100 posts" in your dashboard
- **Used for**: Creating new tweets, replies, etc.

### GET Endpoints (Fetching Data)
- **User Timeline** (`GET /2/users/:id/tweets`): **15 requests per 15 minutes** (Free tier)
- **User Lookup** (`GET /2/users/me`): 300 requests per 15 minutes (Free tier)
- **Used for**: Fetching your tweets, analytics, profile data

## Why Analytics Hits Rate Limits Quickly

When you fetch analytics, the code makes **2 API calls**:

1. `v2.me()` - Gets your user ID (User Lookup endpoint)
2. `v2.userTimeline()` - Gets your tweets (User Timeline endpoint)

**Each analytics fetch = 2 API calls**

With the free tier's **15 requests per 15 minutes** limit for user timeline:
- You can only fetch analytics **~7 times per 15 minutes** (15 requests ÷ 2 calls per fetch)
- If you refresh the analytics page multiple times, you'll hit the limit quickly
- **Failed attempts also count** against the rate limit

## Rate Limit Details

### Free Tier Limits (What You're On)

| Endpoint Type | Limit | Window |
|--------------|------|--------|
| POST Tweets | 50-100/day | 24 hours |
| GET User Timeline | 15 requests | 15 minutes |
| GET User Lookup | 300 requests | 15 minutes |
| GET Tweet Lookup | 300 requests | 15 minutes |

### What Counts Against Limits

- ✅ Successful API calls
- ✅ Failed authentication attempts
- ✅ Rate limit errors (ironically)
- ✅ Retry attempts
- ✅ Calls from other applications using the same credentials

## Solutions

### Option 1: Use Apify for Analytics (Recommended)

**Why Apify is Better for Analytics:**
- No rate limits from X API
- Can fetch historical data more reliably
- Better for bulk analytics operations
- Doesn't consume your X API quota

**Implementation:**
1. Configure Apify credentials in Settings
2. The system will automatically use Apify for analytics
3. Keep X API only for posting tweets

### Option 2: Upgrade X API Plan

**Paid Tiers Have Higher Limits:**
- Basic ($100/month): 10,000 tweets/month, 300 requests/15min for timeline
- Pro ($5,000/month): 1M tweets/month, 1,500 requests/15min for timeline

### Option 3: Implement Better Rate Limit Handling

The code has been improved to:
- Extract rate limit headers from X API responses
- Show remaining requests and reset time
- Provide clearer error messages
- Cache analytics data to reduce API calls

### Option 4: Wait and Retry

If you hit a rate limit:
- Wait 15 minutes for the window to reset
- The error message now shows when the limit resets
- Avoid refreshing the analytics page multiple times

## Current Implementation Improvements

The codebase has been updated to:

1. **Extract Rate Limit Info**: Now parses rate limit headers from X API responses
2. **Better Error Messages**: Shows remaining requests and reset time
3. **Clearer Explanations**: Explains the difference between POST and GET rate limits

## Recommended Approach

**For Your Use Case: Use Apify for Analytics**

Since you're already considering switching to Apify for analytics:

1. **Keep X API for posting** - You have plenty of POST quota (8/100)
2. **Use Apify for analytics** - No rate limit issues
3. **Best of both worlds** - Reliable posting + unlimited analytics

The system already supports this hybrid approach. Just configure Apify credentials and the analytics will automatically use Apify instead of X API.

## How to Check Your Rate Limits

Unfortunately, X API doesn't provide a dashboard that shows GET endpoint usage. The "8/100 posts" only shows POST endpoint usage.

To check if you're rate limited:
1. Look at the error message - it now shows remaining requests if available
2. Wait 15 minutes and try again
3. Check server logs for rate limit information

## Summary

- ✅ "8/100 posts" = POST endpoint usage (creating tweets) - You're fine here
- ❌ Analytics uses GET endpoints with separate, stricter limits
- ⚠️ Free tier: Only 15 timeline requests per 15 minutes
- 💡 Solution: Use Apify for analytics, keep X API for posting

