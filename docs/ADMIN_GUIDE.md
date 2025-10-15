# Administrator Guide - Social Autopilot

This guide is for system administrators who manage users, roles, permissions, and system configuration in Social Autopilot.

## Table of Contents

1. [Administrator Overview](#administrator-overview)
2. [User Management](#user-management)
3. [Role Configuration](#role-configuration)
4. [Permission Management](#permission-management)
5. [Team Management](#team-management)
6. [Security Settings](#security-settings)
7. [Audit Logs](#audit-logs)
8. [System Configuration](#system-configuration)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Administrator Overview

As an administrator, you have full access to all system features and are responsible for:

- **User Management**: Creating, updating, and managing user accounts
- **Access Control**: Assigning roles and managing permissions
- **Team Organization**: Creating and managing teams
- **Security Monitoring**: Reviewing audit logs and security events
- **System Configuration**: Configuring integrations and settings
- **Compliance**: Ensuring regulatory compliance and data protection

### Administrator Responsibilities

✅ **Daily Tasks**:
- Monitor new user registrations
- Review and approve role change requests
- Check for security alerts

✅ **Weekly Tasks**:
- Review audit logs for unusual activity
- Update team memberships as needed
- Check system health and performance

✅ **Monthly Tasks**:
- Conduct security audits
- Review and update permissions
- Archive old audit logs
- Update system documentation

## User Management

### Viewing All Users

1. Navigate to **Dashboard** → **User Management**
2. You'll see a list of all users with:
   - Name and email
   - Current role
   - Account status
   - Last login date
   - Registration date

3. Use filters to find specific users:
   - Filter by role (Admin, Editor, Viewer)
   - Filter by status (Active, Inactive, Suspended)
   - Search by name or email

### Creating User Accounts

**Option 1: User Self-Registration**
- Users can register themselves via the sign-up page
- New users automatically receive the VIEWER role
- Admin can upgrade roles after verification

**Option 2: Admin-Created Accounts**
1. Go to User Management
2. Click "Create New User"
3. Fill in required information:
   - Email address
   - First and last name
   - Initial role assignment
4. Choose whether to send welcome email
5. Click "Create User"
6. User receives email with setup instructions

### Editing User Information

1. Go to User Management
2. Find the user you want to edit
3. Click the "Edit" button or user's name
4. Update any of the following:
   - Name and display name
   - Email address (triggers verification)
   - Role assignment
   - Account status
5. Click "Save Changes"

**Note**: Changing a user's email requires them to verify the new address.

### Assigning Roles

To change a user's role:

1. Go to User Management
2. Select the user
3. Click "Change Role"
4. Choose the new role:
   - **Admin**: Full system access
   - **Editor**: Content creation and management
   - **Viewer**: Read-only access
5. Add a reason for the change (for audit trail)
6. Click "Update Role"

The user will be notified of the role change via email.

### Suspending User Accounts

To temporarily suspend a user:

1. Go to User Management
2. Find the user
3. Click "Suspend Account"
4. Enter a reason for suspension
5. Choose suspension duration (or indefinite)
6. Click "Confirm Suspension"

**What happens when a user is suspended**:
- User cannot log in
- Active sessions are immediately terminated
- User receives notification email
- Audit log entry is created

To reactivate:
1. Find the suspended user
2. Click "Reactivate Account"
3. Enter a reason
4. Click "Confirm"

### Deleting User Accounts

⚠️ **Warning**: Permanent action. Use with caution.

1. Go to User Management
2. Find the user
3. Click "Delete Account"
4. Review the warning message
5. Enter your admin password to confirm
6. Type "DELETE" to confirm
7. Click "Permanently Delete Account"

**What gets deleted**:
- User profile and settings
- User-created content (optionally transfer to another user)
- Session data
- Activity logs remain for compliance

## Role Configuration

### Understanding the Role Hierarchy

```text
ADMIN (Highest Privileges)
  ├─ Full system access
  ├─ User and role management
  ├─ System configuration
  └─ Audit access

EDITOR (Content Management)
  ├─ Create and manage content
  ├─ Upload media
  ├─ View analytics
  └─ Team collaboration

VIEWER (Read-Only)
  ├─ View content
  ├─ View analytics
  └─ Access own profile
```

### Default Roles and Permissions

#### ADMIN Role
**Full Access To**:
- All post management operations
- All media management
- All analytics and reporting
- User and role management
- System settings and integrations
- Team management
- Automation configuration
- Billing and subscription
- API management
- Audit logs

#### EDITOR Role
**Access To**:
- Create, edit, and schedule posts
- Upload and manage own media
- View analytics and export data
- View users and teams
- Assign content to teams
- Create automated replies
- View own activity logs

**No Access To**:
- User management
- Role assignment
- System settings
- Audit logs (except own)
- Billing management

#### VIEWER Role
**Access To**:
- View posts and content
- View analytics dashboards
- View team assignments
- View own profile and settings

**No Access To**:
- Creating or editing content
- Media uploads
- User management
- System settings
- Audit logs

### Creating Custom Roles (Future Feature)

Coming soon: Ability to create custom roles with specific permission sets.

## Permission Management

### Understanding Permissions

Permissions are granular access controls that override role-based permissions.

### Permission Categories

**1. Post Management (7 permissions)**
- `CREATE_POST`: Create new posts
- `EDIT_POST`: Modify existing posts
- `DELETE_POST`: Remove posts
- `PUBLISH_POST`: Publish posts live
- `APPROVE_POST`: Approve posts for publishing
- `SCHEDULE_POST`: Schedule posts for later
- `VIEW_POST`: View posts

**2. Content Management (3 permissions)**
- `UPLOAD_MEDIA`: Upload images/videos
- `DELETE_MEDIA`: Remove media files
- `MANAGE_CONTENT`: Full content management

**3. Analytics & Reporting (4 permissions)**
- `VIEW_ANALYTICS`: View analytics dashboards
- `EXPORT_DATA`: Export analytics data
- `VIEW_ENGAGEMENT_METRICS`: View engagement data
- `VIEW_PERFORMANCE_REPORTS`: View performance reports

**4. User Management (4 permissions)**
- `MANAGE_USERS`: Create, edit, delete users
- `ASSIGN_ROLES`: Change user roles
- `VIEW_USERS`: View user list
- `DEACTIVATE_USERS`: Suspend accounts

**5. Settings & Configuration (3 permissions)**
- `MANAGE_SETTINGS`: Modify system settings
- `MANAGE_INTEGRATIONS`: Configure integrations
- `VIEW_SYSTEM_LOGS`: Access system logs

**6. Team Management (4 permissions)**
- `MANAGE_TEAMS`: Create and edit teams
- `ASSIGN_TO_TEAMS`: Add users to teams
- `INVITE_MEMBERS`: Send team invitations
- `REMOVE_MEMBERS`: Remove team members

**7. Automation (3 permissions)**
- `MANAGE_AUTOMATION`: Configure automation rules
- `CREATE_AUTO_REPLIES`: Set up auto-replies
- `MANAGE_SCHEDULING`: Manage scheduling rules

**8. Billing & Subscription (2 permissions)**
- `VIEW_BILLING`: View billing information
- `MANAGE_SUBSCRIPTION`: Modify subscription

**9. API Access (2 permissions)**
- `ACCESS_API`: Use API endpoints
- `MANAGE_API_KEYS`: Create/revoke API keys

### Granting Custom Permissions

To grant a specific permission to a user:

1. Go to User Management
2. Select the user
3. Click "Manage Permissions"
4. Click "Grant Permission"
5. Select the permission from the list
6. Add a reason for granting
7. Set expiration date (optional)
8. Click "Grant"

The user now has this permission in addition to their role-based permissions.

### Revoking Permissions

To revoke a custom permission:

1. Go to User Management
2. Select the user
3. Click "Manage Permissions"
4. Find the permission to revoke
5. Click "Revoke"
6. Enter a reason
7. Click "Confirm"

### Viewing Permission Audit Logs

Track all permission checks and changes:

1. Go to Audit Logs
2. Filter by "Permission Events"
3. View details including:
   - User who made the request
   - Permission checked
   - Result (granted/denied)
   - Timestamp
   - Context (resource accessed)

## Team Management

### Creating Teams

1. Navigate to **Team Management**
2. Click "Create New Team"
3. Enter team information:
   - **Team Name**: Descriptive name
   - **Description**: Purpose and scope
   - **Privacy**: Public or Private
4. Click "Create Team"

### Adding Team Members

**Option 1: Invite by Email**
1. Open the team
2. Click "Invite Members"
3. Enter email addresses (comma-separated)
4. Select their team role:
   - Owner
   - Admin
   - Member
   - Viewer
5. Add a personal message (optional)
6. Click "Send Invitations"

**Option 2: Add Existing Users**
1. Open the team
2. Click "Add Members"
3. Select users from the list
4. Choose their team role
5. Click "Add to Team"

### Managing Team Roles

Team roles are separate from system roles:

- **Owner**: Full control, can delete team
- **Admin**: Manage members and content
- **Member**: Create and collaborate on content
- **Viewer**: Read-only access

To change a team member's role:
1. Open the team
2. Go to Members tab
3. Find the member
4. Click "Change Role"
5. Select new role
6. Click "Update"

### Removing Team Members

1. Open the team
2. Go to Members tab
3. Find the member
4. Click "Remove from Team"
5. Confirm the action

**Note**: Removing a member doesn't delete their account, only removes them from the team.

### Deleting Teams

⚠️ **Warning**: This will delete all team content and memberships.

1. Go to Team Management
2. Select the team
3. Click "Delete Team"
4. Review what will be deleted
5. Enter your password to confirm
6. Type the team name to confirm
7. Click "Permanently Delete Team"

## Security Settings

### Configuring Authentication

**Password Policy**:
1. Go to **Settings** → **Security**
2. Configure password requirements:
   - Minimum length (default: 8)
   - Require uppercase letters
   - Require numbers
   - Require special characters
   - Password expiration (optional)
3. Click "Save Policy"

**Session Configuration**:
- Maximum session duration: 30 days
- Idle timeout: Configurable (15, 30, 60, 120 minutes)
- Concurrent sessions: Allowed by default
- Session timeout on browser close: Optional

**Two-Factor Authentication**:
- Enable 2FA requirement for Admin accounts
- Make 2FA optional for other roles
- Configure 2FA backup codes

### Monitoring Failed Login Attempts

1. Go to **Security** → **Login Attempts**
2. View failed login attempts:
   - Username/email attempted
   - Timestamp
   - IP address
   - Reason for failure
3. Configure automatic lockout:
   - Number of attempts before lockout (default: 5)
   - Lockout duration (default: 15 minutes)
   - Email notification to user

### IP Allowlisting (Optional)

Restrict access to specific IP addresses:

1. Go to **Settings** → **Security** → **IP Access**
2. Enable "IP Allowlist"
3. Add allowed IP addresses or ranges
4. Save changes

**Warning**: Be careful not to lock yourself out!

### Reviewing Active Sessions

View all active user sessions:

1. Go to **Security** → **Active Sessions**
2. See all logged-in users:
   - Username
   - Device and browser
   - IP address
   - Login time
   - Last activity
3. Revoke suspicious sessions:
   - Select session
   - Click "Revoke Session"
   - User will be logged out immediately

## Audit Logs

### Understanding Audit Logs

Audit logs track all significant events for security and compliance:

- Authentication events (login, logout, failed attempts)
- User management (creation, updates, deletion)
- Role and permission changes
- Content creation and modification
- Settings changes
- API access
- Security events

### Viewing Audit Logs

1. Navigate to **Audit Logs** from the admin menu
2. Use filters to find specific events:
   - **Date Range**: Last 24 hours, 7 days, 30 days, custom
   - **Event Type**: Authentication, User Management, Content, etc.
   - **User**: Filter by specific user
   - **Action**: Filter by specific action
   - **IP Address**: Filter by IP address

3. View log details:
   - Timestamp
   - User who performed the action
   - Action type
   - Resource affected
   - IP address and user agent
   - Result (success/failure)
   - Additional context

### Exporting Audit Logs

For compliance or investigation:

1. Go to Audit Logs
2. Apply desired filters
3. Click "Export Logs"
4. Choose format:
   - CSV (for spreadsheets)
   - JSON (for systems integration)
   - PDF (for reports)
5. Click "Download"

Exports include all filtered events with full details.

### Setting Up Audit Log Alerts

Configure alerts for critical events:

1. Go to **Settings** → **Audit Alerts**
2. Click "Create Alert Rule"
3. Configure:
   - Event type to monitor
   - Conditions (e.g., multiple failed logins)
   - Alert recipients (admin emails)
   - Alert frequency (immediate, daily digest)
4. Save the alert rule

Common alert scenarios:
- Multiple failed login attempts
- Role changes
- Permission grants
- Account deletions
- Unusual login locations

### Audit Log Retention

Configure how long to keep audit logs:

1. Go to **Settings** → **Audit Configuration**
2. Set retention period:
   - Authentication logs: 90 days (recommended)
   - User management: 1 year (recommended)
   - Permission audits: 1 year (recommended)
   - Content events: 90 days
3. Enable automatic archival (optional)
4. Save settings

**Compliance Note**: Some regulations require specific retention periods. Consult your legal team.

## System Configuration

### Managing Integrations

**Twitter/X API Configuration**:
1. Go to **Settings** → **Integrations** → **Twitter**
2. Enter API credentials:
   - API Key
   - API Secret
   - Bearer Token
3. Test connection
4. Save settings

**Other Integrations**:
- Apify (for web scraping)
- Analytics platforms
- Third-party services

### Email Configuration

Configure email settings for notifications:

1. Go to **Settings** → **Email**
2. Configure SMTP settings:
   - SMTP host
   - SMTP port
   - Username
   - Password
   - From address
   - From name
3. Test email delivery
4. Save settings

### Notification Templates

Customize email templates:

1. Go to **Settings** → **Notifications** → **Templates**
2. Select template to edit:
   - Welcome email
   - Password reset
   - Role change notification
   - Team invitation
   - Security alerts
3. Edit template content
4. Preview changes
5. Save template

### Backup Configuration

Set up automated backups:

1. Go to **Settings** → **Backup**
2. Configure backup schedule:
   - Frequency (daily, weekly)
   - Time of day
   - Retention period
3. Configure backup destination:
   - Database
   - User-uploaded files
   - Configuration files
4. Test backup process
5. Save settings

## Best Practices

### Security Best Practices

1. **Regular Audits**
   - Review audit logs weekly
   - Check for unusual patterns
   - Investigate suspicious activities

2. **Access Control**
   - Follow principle of least privilege
   - Grant only necessary permissions
   - Regularly review role assignments

3. **Password Management**
   - Enforce strong password policies
   - Require 2FA for admin accounts
   - Regular password rotation for service accounts

4. **Session Management**
   - Set appropriate timeout periods
   - Monitor active sessions
   - Revoke stale sessions

5. **Updates and Patches**
   - Keep system updated
   - Review security advisories
   - Test updates in staging first

### User Management Best Practices

1. **Onboarding**
   - Provide clear welcome email
   - Assign appropriate initial role
   - Schedule follow-up training

2. **Role Assignment**
   - Document role change requests
   - Verify request with user's manager
   - Log all role changes

3. **Offboarding**
   - Revoke access immediately upon departure
   - Transfer ownership of content
   - Archive user data per policy

### Compliance Best Practices

1. **Data Protection**
   - Regular privacy audits
   - Data minimization
   - Secure data storage

2. **Access Logging**
   - Log all data access
   - Monitor export activities
   - Review logs regularly

3. **Incident Response**
   - Have response plan ready
   - Document incidents
   - Conduct post-mortem reviews

## Troubleshooting

### Users Can't Log In

**Common Causes**:
- Incorrect password (reset via "Forgot Password")
- Account suspended (check user status)
- Too many failed attempts (wait 15 minutes or unlock account)
- Email not verified (resend verification email)

**Admin Actions**:
1. Check user account status
2. Review recent audit logs for the user
3. Reset user password if needed
4. Unlock account if locked

### Permission Issues

**User reports they can't access a feature**:

1. Check user's current role
2. Verify role has required permission
3. Check for permission overrides
4. Review permission audit logs
5. Grant explicit permission if needed

### Team Access Problems

**User can't see team content**:

1. Verify user is team member
2. Check team membership status
3. Verify team privacy settings
4. Check user's team role
5. Re-add user to team if needed

### Audit Log Issues

**Logs not appearing**:

1. Check audit logging is enabled
2. Verify database connectivity
3. Check log retention settings
4. Review system error logs

### Performance Issues

**System running slowly**:

1. Check database performance
2. Review audit log size (archive if needed)
3. Check for too many active sessions
4. Review error logs for issues
5. Contact technical support

### Getting Help

**Internal Resources**:
- Check system documentation
- Review knowledge base
- Ask fellow admins

**External Support**:
- Email: admin-support@example.com
- Priority support for admins
- Response time: Within 4 hours

**Emergency Contact**:
- For critical security issues
- 24/7 hotline: [emergency-number]
- Email: security@example.com

---

**Questions?** Contact the admin support team at admin-support@example.com

