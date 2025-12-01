# Demo Mode Guide for Task 21: Engagement Automation

## Overview

Demo mode allows you to test the entire engagement automation system without X API credentials. It generates realistic demo mentions that are stored in the database and work with all features.

## Features

✅ **Automatic Activation**: Demo mode activates automatically when X API credentials are missing or invalid

✅ **Realistic Data**: Generates mentions with:
- Different sentiments (positive, negative, neutral)
- Various priority levels
- Realistic text content
- Proper sentiment analysis
- Automatic flagging based on priority

✅ **Database Integration**: Demo mentions are stored in the database just like real mentions

✅ **Full Feature Support**: All features work with demo mentions:
- Sentiment analysis
- Priority flagging
- Auto-reply rules
- Analytics
- Filtering

✅ **Automatic Generation**: When monitoring is active, generates new mentions every 30 seconds

✅ **Manual Generation**: Button to manually generate demo mentions for testing

## How to Use

### Automatic Demo Mode

1. **Start Monitoring Without Credentials**:
   - Navigate to Dashboard → Engagement → Live Mentions
   - Click "Start Monitoring"
   - System automatically detects missing credentials and enters demo mode
   - Initial batch of 5 demo mentions is generated
   - New mentions are generated every 30 seconds

2. **View Demo Mentions**:
   - Demo mentions appear in the mentions list
   - They have sentiment badges (positive/negative/neutral)
   - Priority levels are automatically calculated
   - Mentions can be filtered, flagged, and replied to

### Manual Demo Mention Generation

1. **Generate Demo Mentions Manually**:
   - In the Live Mentions tab, click "Generate Demo Mentions" button
   - Generates 5 new demo mentions immediately
   - Mentions are added to the database and appear in the list

2. **Via API**:
   ```bash
   curl -X POST http://localhost:3000/api/mentions/demo \
     -H "Content-Type: application/json" \
     -H "x-user-id: demo-user" \
     -d '{"count": 5}'
   ```

## Demo Mention Types

The system includes 10 different demo mention templates:

1. **Happy Customer** - Positive sentiment
   - "Love the new update! Great work team! 👏"

2. **Needs Help** - Neutral sentiment, support request
   - "I need help with my account. How do I reset my password?"

3. **Frustrated User** - Negative sentiment
   - "This is terrible! The app keeps crashing. Very disappointed."

4. **Question Asker** - Neutral sentiment
   - "Can you help me understand how to use the new feature?"

5. **Support Seeker** - Neutral sentiment
   - "Having issues with login, can someone help?"

6. **Excited User** - Positive sentiment
   - "This feature is amazing! Just what I needed. Thank you! 🎉"

7. **Confused Customer** - Neutral sentiment
   - "How does the new feature work? I can't figure it out."

8. **Angry User** - Negative sentiment, high priority
   - "This is unacceptable! Lost all my data. Need immediate help!"

9. **Satisfied Client** - Positive sentiment
   - "Been using this for a week now. Really impressed with the quality!"

10. **Tech Savvy** - Neutral sentiment
    - "Is there an API available? Would love to integrate this into my workflow."

## Testing with Demo Mode

### Test Auto-Reply Rules

1. Create an auto-reply rule with keywords like "help", "password", "issue"
2. Start monitoring (demo mode activates)
3. Demo mentions matching your rules will trigger auto-replies
4. Check auto-reply logs to see generated replies

### Test Sentiment Analysis

1. Generate demo mentions
2. View mentions in the list
3. Each mention has a sentiment badge (positive/negative/neutral)
4. Sentiment confidence scores are displayed

### Test Priority Flagging

1. Generate demo mentions
2. Navigate to Flagged Mentions tab
3. Mentions with high priority scores are automatically flagged
4. View flag reasons and priority levels

### Test Analytics

1. Generate multiple demo mentions
2. Navigate to Analytics tab
3. View metrics, charts, and time series data
4. All analytics work with demo mentions

### Test Filtering

1. Generate demo mentions
2. Use filter dropdown to filter by:
   - All Mentions
   - Unread Only
   - High Priority
   - Negative Sentiment
   - Positive Sentiment

## Demo Mode Indicators

- **Console Logs**: Look for "No valid Twitter credentials found, running in demo mode"
- **API Response**: Response includes `mode: 'demo'` when in demo mode
- **Monitoring Status**: Badge shows "Monitoring Active" even in demo mode

## Database Structure

Demo mentions are stored in the `mentions` table with:
- `user_id`: 'demo-user' (or your user ID)
- `tweet_id`: Unique demo tweet ID (format: `demo-{timestamp}-{index}-{random}`)
- `author_username`: Demo username (e.g., 'happy_customer')
- `author_name`: Demo author name
- `text`: Demo mention text
- `sentiment`: Analyzed sentiment (positive/neutral/negative)
- `sentiment_confidence`: Confidence score (0-1)
- `priority_score`: Calculated priority score
- `is_flagged`: Auto-flagged if priority is high

## Limitations

- Demo mentions are not real Twitter/X mentions
- They won't appear on actual Twitter/X
- Auto-replies won't be sent to real Twitter/X accounts (they're logged only)
- Demo mentions use randomized follower counts for display

## Troubleshooting

### Demo Mentions Not Appearing

1. Check browser console for errors
2. Verify database connection
3. Check that migration has been run
4. Try manually generating mentions with the button

### Monitoring Not Starting

1. Check browser console for error messages
2. Verify the API endpoint is accessible
3. Check network tab in browser DevTools

### Mentions Not Updating

1. Ensure monitoring is active (badge shows "Monitoring Active")
2. Wait 30 seconds for automatic generation
3. Manually refresh the page
4. Click "Generate Demo Mentions" button

## API Endpoints

### Generate Demo Mentions
```
POST /api/mentions/demo
Headers:
  Content-Type: application/json
  x-user-id: demo-user
Body:
  {
    "count": 5
  }
```

### Get Demo Mentions
```
GET /api/mentions/demo?limit=50
Headers:
  x-user-id: demo-user
```

### Start Monitoring (Auto Demo Mode)
```
GET /api/mentions/stream
Headers:
  x-user-id: demo-user
```

### Stop Monitoring
```
DELETE /api/mentions/stream
Headers:
  x-user-id: demo-user
```

---

*Demo mode is designed for testing and development. For production use, configure valid X API credentials.*

