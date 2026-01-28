# Quick Fix: Apply Migration and Re-enter Apify Credentials

## Step 1: Apply the Database Migration

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project
   - Click on "SQL Editor" in the left sidebar

2. **Run the Migration**
   - Click "New Query"
   - Copy and paste the ENTIRE contents of this file:
     `supabase/migrations/20251217000000_make_credential_fields_nullable.sql`
   - Click "Run" (or press Cmd+Enter / Ctrl+Enter)

3. **Verify Migration Applied**
   - You should see messages like:
     - "Made encrypted_api_secret nullable"
     - "Made encrypted_access_token nullable"
     - "Made encrypted_access_secret nullable"

## Step 2: Re-enter Your Apify Credentials

1. **Go to Settings**
   - In your app, go to Settings → Apify (or Integrations)

2. **Enter Your Apify API Key**
   - Enter your Apify API key
   - Click "Save" or "Test Connection"

3. **Verify It Saved**
   - You should see a success message
   - Check the server logs - you should see:
     - `✅ Apify credentials stored successfully`

## Step 3: Test Analytics

1. **Go to Analytics Page**
   - Navigate to the Analytics tab

2. **Check Server Logs**
   - You should now see:
     - `✅ Apify credentials found. Using Apify for analytics...`
     - `📡 Fetching post analytics from Apify for @username...`

## If You Still See Issues

Check the server logs for:
- `❌ Failed to store Apify credentials:` - Migration not applied
- `✅ Apify credentials stored successfully` - Credentials saved
- `✅ Apify credentials found` - System will use Apify

