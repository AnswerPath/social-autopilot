# Manual Testing Guide for Task 21: Engagement Automation

This guide contains **only the tests that require manual human interaction**. Automated tests for code structure and API endpoints are in `__tests__/engagement-automation.test.ts`.

## Prerequisites

### Where to Run Commands

All commands should be run in a **terminal/command line** in the project root directory:
```
/Users/lanestoeger/social-autopilot/socialautopilotnew/social-autopilot
```

**How to open a terminal:**
- **macOS**: Open "Terminal" app (Applications → Utilities → Terminal)
- **VS Code/Cursor**: Press `` Ctrl+` `` (backtick) or View → Terminal
- **Or use the integrated terminal in your IDE**

**Verify you're in the right directory:**
```bash
pwd
# Should show: /Users/lanestoeger/social-autopilot/socialautopilotnew/social-autopilot
```

### Setup Steps

1. **Database Migration**: Ensure the migration has been run:
   ```bash
   # Check if migration exists
   ls supabase/migrations/20250120000000_engagement_automation.sql
   
   # Run migration if using Supabase CLI
   supabase db reset
   # OR apply via Supabase dashboard
   ```

2. **Development Server**: Start the Next.js development server:
   ```bash
   # In your terminal, run:
   npm run dev
   ```
   
   **Expected output:**
   ```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   - ready started server on 0.0.0.0:3000
   ```
   
   **Note:** Keep this terminal window open while testing. Press `Ctrl+C` to stop the server.

3. **Access Application**: Open `http://localhost:3000` in your browser

4. **Login**: Log in with your credentials (or use demo mode)

5. **Twitter/X API Credentials**: Ensure you have valid Twitter/X API credentials configured in the application (if testing real mention monitoring)

---

## 1. Database Setup Verification

### Test: Verify Database Tables

**Steps:**
1. Open Supabase Dashboard → Table Editor
2. Navigate to your project's database
3. Check for the following tables:
   - `auto_reply_rules`
   - `mentions`
   - `auto_reply_logs`
   - `mention_analytics`

**Expected Results:**
- ✅ All 4 tables exist
- ✅ Tables have correct column structure matching the migration
- ✅ Indexes are created
- ✅ RLS policies are enabled

**Manual Verification:**
- Click on each table and verify columns match the migration schema
- Check that indexes exist (may need to check SQL editor or table structure)

---

## 2. Mention Monitoring System (Subtask 21.1)

### Test: Start/Stop Mention Monitoring

**Steps:**
1. Navigate to: `http://localhost:3000/dashboard`
2. Click on "Engagement" tab in the sidebar
3. Look for the "Engagement Monitor" component at the top
4. Click "Start Monitoring" button (or similar control)
5. Wait a few seconds
6. Verify the status changes to "Running" or shows active indicator
7. Click "Stop Monitoring" button
8. Verify the status changes to "Stopped" or shows inactive indicator

**Expected Results:**
- ✅ Monitoring starts without errors
- ✅ Status indicator shows "Running" or active state
- ✅ No console errors in browser DevTools
- ✅ Monitoring stops cleanly
- ✅ Status indicator shows "Stopped" or inactive state

**What to Check:**
- Browser console (F12) for any JavaScript errors
- Network tab for API calls to `/api/mentions/stream`
- UI feedback (toast notifications, status badges)

### Test: View Captured Mentions

**Steps:**
1. Ensure mention monitoring is running
2. Wait for mentions to be captured (or manually trigger if possible)
3. Navigate to the mentions list/view in the Engagement tab
4. Verify mentions appear in the list

**Expected Results:**
- ✅ Mentions are displayed in a list or table
- ✅ Each mention shows:
  - Author username
  - Mention text
  - Timestamp
  - Sentiment (if analyzed)
- ✅ Mentions are sorted by most recent first

**What to Check:**
- Database directly: Query `mentions` table in Supabase
- UI displays mentions correctly
- Sentiment is populated for mentions

### Test: Sentiment Analysis on Capture

**Steps:**
1. Ensure monitoring is running
2. Wait for a new mention to be captured
3. Check the mention in the database or UI
4. Verify sentiment fields are populated

**Expected Results:**
- ✅ `sentiment` field is set to 'positive', 'neutral', or 'negative'
- ✅ `sentiment_confidence` is a number between 0 and 1
- ✅ Sentiment is displayed in the UI (if shown)

**What to Check:**
- Supabase Table Editor: Check `mentions` table
- UI: Check if sentiment badges/indicators appear
- Console: Check for any sentiment analysis errors

---

## 3. Auto-Reply Rules Management (Subtask 21.2)

### Test: Create Auto-Reply Rule

**Steps:**
1. Navigate to: `http://localhost:3000/dashboard`
2. Click "Engagement" tab → "Auto-Reply Rules" sub-tab
3. Click "Create Rule" button
4. Fill in the form:
   - **Rule Name**: "Customer Support - Urgent"
   - **Keywords**: Enter "help, support, question, issue" (comma-separated or as tags)
   - **Phrases**: Enter "need help, how do I" (comma-separated or as tags)
   - **Response Template**: "Hi {{author_username}}, thanks for reaching out! We'll get back to you soon."
   - **Priority**: 5
   - **Match Type**: Select "Any (OR)"
   - **Is Active**: Checked
5. Click "Save" or "Create Rule"
6. Verify the rule appears in the list

**Expected Results:**
- ✅ Form validation works (shows errors for required fields)
- ✅ Rule is created successfully
- ✅ Success toast notification appears
- ✅ Rule appears in the rules list
- ✅ Rule shows correct information (name, keywords, status)

**What to Check:**
- Form validation messages
- Toast notifications
- Rules list updates
- Database: Check `auto_reply_rules` table

### Test: Edit Auto-Reply Rule

**Steps:**
1. In the Auto-Reply Rules list, find a rule
2. Click "Edit" button on the rule
3. Modify one or more fields:
   - Change rule name
   - Add/remove keywords
   - Modify response template
4. Click "Save"
5. Verify changes are reflected in the list

**Expected Results:**
- ✅ Edit dialog/form opens with current values
- ✅ Changes are saved successfully
- ✅ Success toast appears
- ✅ Updated rule shows new values in the list

**What to Check:**
- Form pre-populates with existing values
- Changes persist after save
- Database reflects changes

### Test: Delete Auto-Reply Rule

**Steps:**
1. In the Auto-Reply Rules list, find a rule
2. Click "Delete" button (may require confirmation)
3. Confirm deletion if prompted
4. Verify the rule is removed from the list

**Expected Results:**
- ✅ Confirmation dialog appears (if implemented)
- ✅ Rule is deleted successfully
- ✅ Success toast appears
- ✅ Rule disappears from the list

**What to Check:**
- Confirmation dialog works
- Rule is removed from UI
- Database: Rule is deleted from `auto_reply_rules` table

### Test: Test Rule Matching

**Steps:**
1. In the Auto-Reply Rules list, find a rule
2. Click "Test" button (if available)
3. Enter test text: "I need help with my account"
4. Click "Run Test" or "Test"
5. Review the test results

**Expected Results:**
- ✅ Test dialog/modal opens
- ✅ Test shows whether rule matched
- ✅ If matched, shows generated response
- ✅ Shows which keywords/phrases matched
- ✅ Response template variables are substituted correctly

**What to Check:**
- Match indicator (matched/not matched)
- Matched keywords/phrases highlighted
- Generated response preview
- Variable substitution (e.g., `{{author_username}}` replaced)

### Test: Rule Matching Logic (Any vs All)

**Steps:**
1. Create a rule with:
   - **Keywords**: "help, urgent"
   - **Match Type**: "Any (OR)"
   - **Response**: "Test response"
2. Test with text: "I need help" (should match - has "help")
3. Test with text: "This is urgent" (should match - has "urgent")
4. Test with text: "Hello world" (should not match)
5. Change Match Type to "All (AND)"
6. Test with text: "I need help" (should NOT match - missing "urgent")
7. Test with text: "I need help, this is urgent" (should match - has both)

**Expected Results:**
- ✅ "Any" mode: Matches if ANY keyword/phrase found
- ✅ "All" mode: Matches only if ALL keywords/phrases found
- ✅ Test results clearly show match status

**What to Check:**
- Match logic works correctly for both modes
- UI clearly indicates which mode is active
- Test results are accurate

---

## 4. Sentiment Analysis (Subtask 21.3)

### Test: Manual Sentiment Analysis

**Steps:**
1. Navigate to a mention (in mentions list or flagged mentions)
2. If there's a "Re-analyze" or "Analyze Sentiment" button, click it
3. Or use the sentiment analysis API endpoint directly:
   - Open browser DevTools → Network tab
   - Find a mention ID
   - Make POST request to `/api/mentions/sentiment` with `{ "mentionId": "<id>" }`
4. Check the result

**Expected Results:**
- ✅ Sentiment is returned: `{ sentiment: "positive"|"neutral"|"negative", confidence: 0.0-1.0 }`
- ✅ Confidence score is reasonable (0-1 range)
- ✅ Mention is updated in database with new sentiment

**What to Check:**
- API response structure
- Sentiment values are valid
- Confidence scores are reasonable
- Database updates correctly

### Test: Batch Sentiment Analysis

**Steps:**
1. Use API endpoint or UI (if available):
   - POST to `/api/mentions/sentiment`
   - Body: `{ "batch": ["Text 1", "Text 2", "Text 3"] }`
2. Review results

**Expected Results:**
- ✅ Returns array of analyses
- ✅ Returns distribution summary
- ✅ All texts are analyzed

**What to Check:**
- Response includes analyses array
- Distribution shows counts for each sentiment
- All texts in batch are processed

### Test: Sentiment Override/Correction

**Steps:**
1. Find a mention with sentiment
2. If UI allows, change sentiment manually
3. Or update directly in database
4. Verify change persists

**Expected Results:**
- ✅ Sentiment can be manually changed (if feature exists)
- ✅ Change is saved to database
- ✅ UI reflects new sentiment

**What to Check:**
- Manual override functionality (if implemented)
- Database updates
- UI updates

---

## 5. Priority Flagging System (Subtask 21.4)

### Test: View Flagged Mentions

**Steps:**
1. Navigate to: `http://localhost:3000/dashboard`
2. Click "Engagement" tab → "Flagged Mentions" sub-tab
3. View the list of flagged mentions

**Expected Results:**
- ✅ Flagged mentions are displayed
- ✅ Each mention shows:
  - Priority level badge (low/medium/high/critical)
  - Priority score
  - Flag reasons
  - Author information
  - Mention text
  - Sentiment badge
- ✅ Mentions are sorted by priority (highest first)

**What to Check:**
- List displays correctly
- Priority badges use correct colors
- All metadata is visible
- Sorting is correct

### Test: Manual Flag/Unflag

**Steps:**
1. Find a mention that is NOT flagged
2. If there's a "Flag" button, click it
3. Verify mention appears in flagged list
4. Click "Unflag" button on a flagged mention
5. Verify mention is removed from flagged list

**Expected Results:**
- ✅ Flag button works
- ✅ Mention is flagged in database (`is_flagged = true`)
- ✅ Unflag button works
- ✅ Mention is unflagged in database (`is_flagged = false`)
- ✅ UI updates immediately

**What to Check:**
- Flag/unflag buttons work
- Database updates correctly
- UI reflects changes
- Toast notifications appear

### Test: Respond to Flagged Mention

**Steps:**
1. In Flagged Mentions list, find a mention
2. Click "Respond" button
3. Enter response text in the dialog
4. Click "Send Response"
5. Verify response is recorded

**Expected Results:**
- ✅ Response dialog opens
- ✅ Response text can be entered
- ✅ Response is saved/recorded
- ✅ Success toast appears
- ✅ Mention shows as "replied" (if applicable)

**What to Check:**
- Dialog opens correctly
- Response is saved to database
- UI updates after response
- Response appears in logs (if applicable)

### Test: Ignore Flagged Mention

**Steps:**
1. In Flagged Mentions list, find a mention
2. Click "Ignore" button
3. Verify mention is handled appropriately

**Expected Results:**
- ✅ Ignore action works
- ✅ Mention is marked as ignored (if feature exists)
- ✅ Success feedback appears

**What to Check:**
- Ignore button works
- Appropriate action is taken
- UI updates

---

## 6. Auto-Reply Execution (Subtask 21.2)

### Test: Automatic Reply Generation

**Steps:**
1. Create an auto-reply rule (see section 3)
2. Ensure mention monitoring is running
3. Wait for a mention that matches the rule
4. OR manually create a test mention in database that matches
5. Check if auto-reply is triggered

**Expected Results:**
- ✅ Auto-reply is generated when mention matches rule
- ✅ Response text uses the rule's template
- ✅ Variables are substituted correctly
- ✅ Reply is logged in `auto_reply_logs` table

**What to Check:**
- Auto-reply logs table for new entries
- Response text matches template
- Variables are substituted
- Mention is marked as `is_replied = true`

### Test: Reply Sending (X API Integration)

**Steps:**
1. Ensure valid X API credentials are configured
2. Create a rule and wait for matching mention
3. Verify reply is sent via X API

**Expected Results:**
- ✅ Reply is sent to X API (if credentials valid)
- ✅ Reply tweet ID is recorded
- ✅ Success is logged
- ✅ OR error is logged if sending fails

**What to Check:**
- `auto_reply_logs` table: `success = true`, `tweet_id` populated
- X API: Check if reply tweet was created
- Error handling if API call fails

### Test: Throttling Mechanism

**Steps:**
1. Create a rule with throttling settings:
   - Max per hour: 2
   - Max per day: 5
2. Trigger multiple mentions that match the rule quickly
3. Verify throttling prevents excessive replies

**Expected Results:**
- ✅ First replies are sent
- ✅ After throttle limit, replies are blocked
- ✅ Throttle status is logged
- ✅ Appropriate error/reason is recorded

**What to Check:**
- Throttle limits are respected
- Logs show throttle status
- UI/API indicates throttling (if applicable)

---

## 7. Analytics Dashboard (Subtask 21.5)

### Test: View Overall Metrics

**Steps:**
1. Navigate to: `http://localhost:3000/dashboard`
2. Click "Engagement" tab → "Analytics" sub-tab
3. View the metrics cards

**Expected Results:**
- ✅ Metrics display correctly:
  - Total mentions count
  - Auto-replies sent count
  - Response rate percentage
  - Flagged mentions count
  - Average priority score
- ✅ Numbers are accurate (match database)

**What to Check:**
- All metric cards display
- Numbers match database queries
- Formatting is correct (percentages, decimals)

### Test: Time Series Charts

**Steps:**
1. In Analytics tab, view the "Mentions Over Time" chart
2. Verify chart displays data
3. Check chart interactivity (hover, tooltips)

**Expected Results:**
- ✅ Line chart renders with data
- ✅ Shows mentions, replies, flagged over time
- ✅ Chart is interactive (hover shows values)
- ✅ Dates are formatted correctly

**What to Check:**
- Chart library loads (Recharts)
- Data points are visible
- Tooltips work on hover
- Legend is clear

### Test: Sentiment Distribution Chart

**Steps:**
1. In Analytics tab, view the "Sentiment Distribution" chart
2. Verify pie chart displays

**Expected Results:**
- ✅ Pie chart renders
- ✅ Shows positive/neutral/negative distribution
- ✅ Percentages are displayed
- ✅ Colors are distinct

**What to Check:**
- Chart renders correctly
- Percentages add up to 100%
- Colors are readable
- Labels are clear

### Test: Rule Performance Chart

**Steps:**
1. In Analytics tab, scroll to "Rule Performance" section
2. View the bar chart

**Expected Results:**
- ✅ Bar chart shows rule performance
- ✅ Displays matches and replies sent per rule
- ✅ Chart is readable and formatted

**What to Check:**
- Chart displays if rules exist
- Data is accurate
- Bars are labeled correctly

### Test: Time Range Selection

**Steps:**
1. In Analytics tab, find time range selector
2. Select "Last 7 days"
3. Verify data updates
4. Select "Last 30 days"
5. Verify data updates
6. Select "Last 90 days"
7. Verify data updates

**Expected Results:**
- ✅ Time range selector works
- ✅ Data updates when range changes
- ✅ Charts refresh with new data
- ✅ Loading state shows during update

**What to Check:**
- Dropdown/selector works
- API calls are made with correct parameters
- Data refreshes correctly
- Loading indicators appear

### Test: Data Export

**Steps:**
1. In Analytics tab, click "Export" button
2. Verify CSV file downloads
3. Open the CSV file
4. Verify data is correct

**Expected Results:**
- ✅ Export button works
- ✅ CSV file downloads
- ✅ File has correct name (includes date)
- ✅ CSV contains correct data
- ✅ Data matches what's shown in UI

**What to Check:**
- Download triggers
- File format is correct CSV
- Data columns are correct
- Data values match UI

---

## 8. Integration Testing

### Test: End-to-End Workflow

**Steps:**
1. Start mention monitoring
2. Create an auto-reply rule with keywords: "test, help"
3. Wait for a mention containing "test" or "help" (or create test mention)
4. Verify complete flow:
   - Mention is captured
   - Sentiment is analyzed
   - Rule matches mention
   - Auto-reply is generated
   - Reply is sent (or logged)
   - Analytics are updated

**Expected Results:**
- ✅ All steps execute without errors
- ✅ Data flows correctly through system
- ✅ All database tables are updated
- ✅ UI reflects changes

**What to Check:**
- No errors in console
- Database records are created/updated
- Logs are created
- Analytics update
- UI shows correct state

### Test: Dashboard Navigation

**Steps:**
1. Navigate between tabs:
   - Dashboard → Engagement → Rules
   - Engagement → Flagged
   - Engagement → Analytics
2. Verify components load correctly

**Expected Results:**
- ✅ Navigation is smooth
- ✅ Components load without errors
- ✅ Data loads correctly
- ✅ No console errors

**What to Check:**
- Tab switching works
- Components render
- API calls succeed
- No JavaScript errors

### Test: Error Handling

**Steps:**
1. Test with invalid data:
   - Try to create rule with empty name
   - Try to create rule with no keywords/phrases
   - Try invalid API calls
2. Test with missing credentials:
   - Disable Twitter credentials
   - Try to start monitoring
3. Verify error messages

**Expected Results:**
- ✅ Validation errors are shown
- ✅ Error messages are user-friendly
- ✅ System doesn't crash
- ✅ Appropriate error handling

**What to Check:**
- Form validation works
- Error messages are clear
- API errors are handled gracefully
- UI shows appropriate feedback

---

## 9. UI/UX Testing

### Test: Form Validation

**Steps:**
1. Try to submit empty forms
2. Enter invalid data (e.g., negative numbers, special characters)
3. Verify validation messages

**Expected Results:**
- ✅ Required field validation works
- ✅ Invalid data is rejected
- ✅ Error messages are clear and helpful
- ✅ Forms don't submit with invalid data

**What to Check:**
- Validation messages appear
- Messages are helpful
- Forms prevent invalid submission

### Test: Loading States

**Steps:**
1. Perform actions that take time:
   - Create/update rules
   - Fetch analytics
   - Start monitoring
2. Verify loading indicators

**Expected Results:**
- ✅ Loading spinners/indicators appear
- ✅ Buttons are disabled during loading
- ✅ User feedback is clear

**What to Check:**
- Loading indicators show
- UI is responsive
- No double-submissions

### Test: Responsive Design

**Steps:**
1. Resize browser window
2. Test on mobile viewport (DevTools device mode)
3. Verify components adapt

**Expected Results:**
- ✅ Components adapt to screen size
- ✅ Layout remains usable
- ✅ Text is readable
- ✅ Buttons/controls are accessible

**What to Check:**
- Mobile view works
- Tablet view works
- Desktop view works
- No horizontal scrolling

### Test: User Feedback (Toasts)

**Steps:**
1. Perform various actions:
   - Create rule
   - Update rule
   - Delete rule
   - Start/stop monitoring
2. Verify toast notifications

**Expected Results:**
- ✅ Success toasts appear for successful actions
- ✅ Error toasts appear for failures
- ✅ Toasts are dismissible
- ✅ Toasts don't overlap

**What to Check:**
- Toast notifications appear
- Messages are clear
- Toasts auto-dismiss
- Multiple toasts stack correctly

---

## Quick Manual Test Checklist

Use this checklist to track your manual testing progress:

### Database & Setup
- [ ] Database tables exist and have correct structure
- [ ] Migration was applied successfully

### Mention Monitoring
- [ ] Start monitoring works
- [ ] Stop monitoring works
- [ ] Mentions are captured and stored
- [ ] Sentiment is analyzed on capture

### Auto-Reply Rules
- [ ] Create rule works
- [ ] Edit rule works
- [ ] Delete rule works
- [ ] Test rule functionality works
- [ ] Rule matching (Any) works
- [ ] Rule matching (All) works
- [ ] Response template variable substitution works

### Sentiment Analysis
- [ ] Manual sentiment analysis works
- [ ] Batch sentiment analysis works
- [ ] Sentiment override works (if implemented)

### Priority Flagging
- [ ] Flagged mentions display correctly
- [ ] Manual flag works
- [ ] Unflag works
- [ ] Respond to flagged mention works
- [ ] Ignore mention works

### Auto-Reply Execution
- [ ] Auto-reply is generated when rule matches
- [ ] Reply is sent via X API (or logged)
- [ ] Throttling works correctly

### Analytics
- [ ] Metrics display correctly
- [ ] Time series chart renders
- [ ] Sentiment distribution chart renders
- [ ] Rule performance chart renders
- [ ] Time range selection works
- [ ] Data export works

### Integration
- [ ] End-to-end workflow completes
- [ ] Dashboard navigation works
- [ ] Error handling is graceful

### UI/UX
- [ ] Form validation works
- [ ] Loading states show
- [ ] Responsive design works
- [ ] Toast notifications work

---

## Common Issues to Watch For

- **Database connection errors**: Check Supabase connection
- **Missing environment variables**: Check `.env` file
- **X API credential issues**: Verify credentials are valid
- **TypeScript type errors**: Check console for type errors
- **Component rendering issues**: Check React DevTools
- **API endpoint 500 errors**: Check server logs
- **Missing data in analytics**: Verify database has data
- **Chart rendering issues**: Check if Recharts is loaded
- **Form submission issues**: Check network tab for API calls

---

## Notes

- Some tests require actual Twitter/X API credentials and may not work in demo mode
- Some tests require time to pass (e.g., waiting for mentions)
- Database queries can be verified directly in Supabase dashboard
- Browser DevTools (F12) are essential for debugging
- Network tab shows all API calls and responses
- Console tab shows JavaScript errors and logs

