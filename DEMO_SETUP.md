# Demo Credentials Setup Guide

This guide will help you set up demo credentials for testing the Social Autopilot application without requiring real Twitter API keys.

## Quick Setup

### Option 1: Using the UI (Recommended)

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Settings → Twitter API:**
   - Go to `http://localhost:3000`
   - Click on "Settings" in the sidebar
   - Click on "Twitter API" tab

3. **Create demo credentials:**
   - If you see a "Database not set up" message, click "Run Setup Wizard"
   - Follow the setup wizard to create the database table
   - Once the database is set up, click "Create Demo Credentials"

### Option 2: Using the Command Line

1. **Set up environment variables:**
   Create a `.env.local` file in your project root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Run the demo setup script:**
   ```bash
   npm run setup-demo
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## What Demo Credentials Provide

The demo credentials include:
- **User ID:** `demo-user`
- **API Key:** `demo_api_key_12345`
- **API Secret:** `demo_api_secret_67890`
- **Access Token:** `demo_access_token_abcde`
- **Access Secret:** `demo_access_secret_fghij`
- **Bearer Token:** `demo_bearer_token_klmno`

## Testing the Setup

Once demo credentials are created:

1. **Go to the Post Composer:**
   - Navigate to the main dashboard
   - Try creating a new post

2. **Test media upload:**
   - Try uploading an image or video
   - The demo credentials should prevent the "No Twitter credentials found" error

3. **Verify in Settings:**
   - Go to Settings → Twitter API
   - You should see the demo credentials listed
   - The database status should show "Healthy"

## Troubleshooting

### "No Twitter credentials found" Error

If you still see this error:

1. **Check database status:**
   - Go to Settings → Twitter API
   - Look at the "Database Storage Status" section
   - Ensure the table exists and is accessible

2. **Recreate demo credentials:**
   - Click "Create Demo Credentials" again
   - This will overwrite any existing demo credentials

3. **Check browser console:**
   - Open browser developer tools
   - Look for any JavaScript errors
   - Check the Network tab for failed API calls

### "Database connection failed" Error

If you see database connection errors:

1. **Verify environment variables:**
   - Ensure your Supabase URL and service key are correct
   - Check that your Supabase project is active

2. **Run database setup:**
   ```bash
   npm run setup-database
   ```

3. **Manual database setup:**
   - Go to your Supabase dashboard
   - Open the SQL Editor
   - Run the SQL script from `scripts/create-credentials-table.sql`

### Media Upload Issues

If media upload fails:

1. **Check the upload endpoint:**
   - The error might be in the `/api/twitter/upload` endpoint
   - Demo credentials should prevent authentication errors

2. **Verify file size limits:**
   - Check that uploaded files are within size limits
   - Try with a smaller test image

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Optional |
| `NODE_ENV` | Environment (development/production) | Yes |

## Next Steps

Once demo credentials are working:

1. **Test all features:**
   - Post creation
   - Media upload
   - Scheduling
   - Analytics

2. **Add real credentials (optional):**
   - If you want to test with real Twitter API
   - Replace demo credentials with real ones in Settings

3. **Development workflow:**
   - Use demo credentials for development
   - Use real credentials for production testing

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify all environment variables are set
3. Ensure your Supabase project is properly configured
4. Try recreating the demo credentials

The demo credentials are designed to work without any external API calls, making them perfect for development and testing.
