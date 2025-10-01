# API Documentation - Social Autopilot

This document provides comprehensive API documentation for Social Autopilot, including authentication, user management, permissions, and team collaboration endpoints.

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Authentication Endpoints](#authentication-endpoints)
4. [User Management Endpoints](#user-management-endpoints)
5. [Profile Management Endpoints](#profile-management-endpoints)
6. [Account Settings Endpoints](#account-settings-endpoints)
7. [Role & Permission Endpoints](#role--permission-endpoints)
8. [Team Management Endpoints](#team-management-endpoints)
9. [Activity Logging Endpoints](#activity-logging-endpoints)
10. [Error Handling](#error-handling)
11. [Rate Limiting](#rate-limiting)
12. [Examples](#examples)

## API Overview

### Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

### API Version

Current version: `v1`

### Content Type

All requests and responses use JSON:
```
Content-Type: application/json
```

### Authentication

Most endpoints require authentication via HTTP-only cookies containing JWT tokens. See [Authentication](#authentication) section for details.

## Authentication

### Authentication Flow

Social Autopilot uses cookie-based authentication with JWT tokens:

1. **Login**: User submits credentials, receives JWT tokens in HTTP-only cookies
2. **Requests**: Cookies automatically sent with each request
3. **Refresh**: Tokens automatically refreshed when expired
4. **Logout**: Cookies cleared, session terminated

### Cookies

- `sb-auth-token`: Access token (1 hour expiry)
- `sb-refresh-token`: Refresh token (7 days expiry)
- `sb-session-id`: Session identifier (30 days expiry)

All cookies are:
- `HttpOnly`: Prevents JavaScript access
- `Secure`: Only sent over HTTPS in production
- `SameSite=lax`: CSRF protection

### Authorization Header (Alternative)

For API integrations, you can use the `Authorization` header:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Authentication Endpoints

### Register New User

Create a new user account.

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "johndoe" // optional
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "johndoe",
    "role": "VIEWER",
    "permissions": ["VIEW_POST", "VIEW_ANALYTICS"],
    "createdAt": "2025-10-01T12:00:00Z"
  },
  "message": "User registered successfully"
}
```

**Errors**:
- `400`: Invalid input (weak password, invalid email)
- `409`: Email already exists
- `500`: Server error

---

### Login

Authenticate user and create session.

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "johndoe",
    "role": "EDITOR",
    "permissions": ["CREATE_POST", "EDIT_POST", "VIEW_ANALYTICS"],
    "lastLogin": "2025-10-01T12:00:00Z"
  },
  "message": "Login successful"
}
```

**Errors**:
- `400`: Missing credentials
- `401`: Invalid credentials
- `429`: Too many failed attempts (account locked)
- `500`: Server error

---

### Logout

Terminate user session.

**Endpoint**: `POST /api/auth/logout`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Refresh Token

Refresh expired access token.

**Endpoint**: `POST /api/auth/refresh`

**Authentication**: Requires refresh token cookie

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Token refreshed successfully"
}
```

**Errors**:
- `401`: Invalid or expired refresh token
- `500`: Server error

---

### Reset Password Request

Request password reset email.

**Endpoint**: `POST /api/auth/reset-password`

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Note**: Always returns success to prevent email enumeration.

---

### Reset Password Confirmation

Complete password reset with token.

**Endpoint**: `POST /api/auth/reset-password/confirm`

**Request Body**:
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Errors**:
- `400`: Invalid or expired token
- `400`: Password doesn't meet requirements
- `500`: Server error

---

### Get Current Session

Get current user session information.

**Endpoint**: `GET /api/auth/session`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "johndoe",
    "role": "EDITOR",
    "permissions": ["CREATE_POST", "EDIT_POST"],
    "avatarUrl": "https://storage.url/avatar.jpg",
    "sessionId": "session-uuid",
    "lastActivity": "2025-10-01T12:00:00Z"
  }
}
```

---

## User Management Endpoints

### Get All Users (Admin Only)

List all users in the system.

**Endpoint**: `GET /api/auth/users`

**Authentication**: Required (Admin only)

**Query Parameters**:
- `role` (optional): Filter by role (ADMIN, EDITOR, VIEWER)
- `status` (optional): Filter by status (active, suspended)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50)

**Response** (200 OK):
```json
{
  "success": true,
  "users": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "EDITOR",
      "status": "active",
      "lastLogin": "2025-10-01T12:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "pages": 2
  }
}
```

---

## Profile Management Endpoints

### Get User Profile

Get current user's profile.

**Endpoint**: `GET /api/profile`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "profile": {
    "id": "profile-uuid",
    "userId": "user-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "johndoe",
    "bio": "Software developer and content creator",
    "timezone": "America/New_York",
    "emailNotifications": true,
    "avatarUrl": "https://storage.url/avatar.jpg",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-10-01T12:00:00Z"
  }
}
```

---

### Update User Profile

Update current user's profile.

**Endpoint**: `PUT /api/profile`

**Authentication**: Required

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "displayName": "johndoe",
  "bio": "Updated bio",
  "timezone": "America/New_York",
  "emailNotifications": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "profile": {
    "id": "profile-uuid",
    "userId": "user-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "displayName": "johndoe",
    "bio": "Updated bio",
    "timezone": "America/New_York",
    "emailNotifications": true,
    "updatedAt": "2025-10-01T12:00:00Z"
  },
  "message": "Profile updated successfully"
}
```

---

### Upload Profile Avatar

Upload a new profile picture.

**Endpoint**: `POST /api/profile/avatar`

**Authentication**: Required

**Content-Type**: `multipart/form-data`

**Request Body**:
```
file: [image file]
```

**Constraints**:
- File types: JPEG, PNG, WebP
- Max size: 5MB
- Recommended dimensions: 400x400px

**Response** (200 OK):
```json
{
  "success": true,
  "avatarUrl": "https://storage.url/avatar.jpg",
  "message": "Avatar uploaded successfully"
}
```

**Errors**:
- `400`: Invalid file type or size
- `401`: Unauthorized
- `500`: Upload failed

---

### Delete Profile Avatar

Remove profile picture.

**Endpoint**: `DELETE /api/profile/avatar`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Avatar deleted successfully"
}
```

---

## Account Settings Endpoints

### Get Account Settings

Get current user's account settings.

**Endpoint**: `GET /api/account-settings`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "settings": {
    "notificationPreferences": {
      "emailNotifications": true,
      "pushNotifications": true,
      "mentionNotifications": true,
      "postApprovalNotifications": true,
      "analyticsNotifications": false,
      "securityNotifications": true,
      "marketingEmails": false,
      "weeklyDigest": true,
      "dailySummary": false
    },
    "securitySettings": {
      "twoFactorEnabled": false,
      "loginNotifications": true,
      "sessionTimeoutMinutes": 60,
      "requirePasswordForSensitiveActions": true
    },
    "accountPreferences": {
      "language": "en",
      "timezone": "America/New_York",
      "dateFormat": "MM/DD/YYYY",
      "timeFormat": "12h",
      "theme": "system",
      "compactMode": false,
      "autoSaveDrafts": true,
      "defaultPostVisibility": "public"
    }
  }
}
```

---

### Update Account Settings

Update account settings.

**Endpoint**: `PUT /api/account-settings`

**Authentication**: Required

**Request Body**: (partial updates allowed)
```json
{
  "notificationPreferences": {
    "emailNotifications": true,
    "weeklyDigest": false
  },
  "securitySettings": {
    "sessionTimeoutMinutes": 120
  },
  "accountPreferences": {
    "theme": "dark"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "settings": {
    // Updated settings object
  },
  "message": "Settings updated successfully"
}
```

---

### Change Password

Update user password.

**Endpoint**: `PUT /api/account-settings/password`

**Authentication**: Required

**Request Body**:
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Errors**:
- `400`: Passwords don't match
- `400`: New password doesn't meet requirements
- `401`: Current password incorrect
- `500`: Server error

---

### Get Active Sessions

List all active sessions for current user.

**Endpoint**: `GET /api/account-settings/sessions`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "session-uuid",
      "device": "Chrome on macOS",
      "ipAddress": "192.168.1.1",
      "location": "New York, US",
      "createdAt": "2025-10-01T10:00:00Z",
      "lastActivity": "2025-10-01T12:00:00Z",
      "isCurrent": true
    },
    {
      "sessionId": "session-uuid-2",
      "device": "Firefox on Windows",
      "ipAddress": "192.168.1.2",
      "location": "Los Angeles, US",
      "createdAt": "2025-09-30T14:00:00Z",
      "lastActivity": "2025-10-01T11:30:00Z",
      "isCurrent": false
    }
  ]
}
```

---

### Revoke Session

Terminate a specific session.

**Endpoint**: `DELETE /api/account-settings/sessions`

**Authentication**: Required

**Request Body**:
```json
{
  "sessionId": "session-uuid-to-revoke"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

### Delete Account

Permanently delete user account.

**Endpoint**: `DELETE /api/account-settings/delete-account`

**Authentication**: Required

**Request Body**:
```json
{
  "password": "CurrentPassword123!",
  "confirmation": "DELETE"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Errors**:
- `400`: Invalid password or confirmation
- `401`: Unauthorized
- `500`: Deletion failed

---

## Role & Permission Endpoints

### Get All Roles

List all available roles.

**Endpoint**: `GET /api/auth/roles`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "roles": [
    {
      "id": "ADMIN",
      "name": "Administrator",
      "description": "Full system access",
      "permissions": ["*"]
    },
    {
      "id": "EDITOR",
      "name": "Editor",
      "description": "Content creation and management",
      "permissions": ["CREATE_POST", "EDIT_POST", "SCHEDULE_POST"]
    },
    {
      "id": "VIEWER",
      "name": "Viewer",
      "description": "Read-only access",
      "permissions": ["VIEW_POST", "VIEW_ANALYTICS"]
    }
  ]
}
```

---

### Get All Permissions

List all available permissions.

**Endpoint**: `GET /api/auth/permissions`

**Authentication**: Required

**Response** (200 OK):
```json
{
  "success": true,
  "permissions": {
    "postManagement": [
      "CREATE_POST",
      "EDIT_POST",
      "DELETE_POST",
      "PUBLISH_POST",
      "APPROVE_POST",
      "SCHEDULE_POST",
      "VIEW_POST"
    ],
    "contentManagement": [
      "UPLOAD_MEDIA",
      "DELETE_MEDIA",
      "MANAGE_CONTENT"
    ],
    "analytics": [
      "VIEW_ANALYTICS",
      "EXPORT_DATA",
      "VIEW_ENGAGEMENT_METRICS",
      "VIEW_PERFORMANCE_REPORTS"
    ]
    // ... more categories
  }
}
```

---

### Check Permission

Check if current user has a specific permission.

**Endpoint**: `POST /api/auth/permissions`

**Authentication**: Required

**Request Body**:
```json
{
  "permission": "CREATE_POST",
  "resourceType": "post", // optional
  "resourceId": "post-uuid" // optional
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "hasPermission": true,
  "reason": "User has EDITOR role which includes CREATE_POST permission"
}
```

---

### Assign Role to User (Admin Only)

Assign a role to a user.

**Endpoint**: `POST /api/auth/users/roles`

**Authentication**: Required (Admin only)

**Request Body**:
```json
{
  "userId": "user-uuid",
  "role": "EDITOR",
  "reason": "Promoted to content creator"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Role assigned successfully",
  "user": {
    "id": "user-uuid",
    "role": "EDITOR",
    "permissions": ["CREATE_POST", "EDIT_POST"]
  }
}
```

---

## Team Management Endpoints

### Get All Teams

List all teams (user-specific based on membership).

**Endpoint**: `GET /api/teams`

**Authentication**: Required

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Results per page

**Response** (200 OK):
```json
{
  "success": true,
  "teams": [
    {
      "id": "team-uuid",
      "name": "Marketing Team",
      "description": "Social media marketing",
      "privacy": "private",
      "memberCount": 5,
      "userRole": "admin",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Create Team (Admin Only)

Create a new team.

**Endpoint**: `POST /api/teams`

**Authentication**: Required (Admin only)

**Request Body**:
```json
{
  "name": "Marketing Team",
  "description": "Social media marketing and content creation",
  "privacy": "private"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "team": {
    "id": "team-uuid",
    "name": "Marketing Team",
    "description": "Social media marketing and content creation",
    "privacy": "private",
    "createdBy": "user-uuid",
    "createdAt": "2025-10-01T12:00:00Z"
  },
  "message": "Team created successfully"
}
```

---

### Get Team Details

Get detailed information about a team.

**Endpoint**: `GET /api/teams/:teamId`

**Authentication**: Required (Team member)

**Response** (200 OK):
```json
{
  "success": true,
  "team": {
    "id": "team-uuid",
    "name": "Marketing Team",
    "description": "Social media marketing",
    "privacy": "private",
    "members": [
      {
        "userId": "user-uuid",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "teamRole": "admin",
        "joinedAt": "2025-01-01T00:00:00Z"
      }
    ],
    "createdBy": "user-uuid",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### Add Team Member (Admin/Owner)

Add a member to a team.

**Endpoint**: `POST /api/teams/:teamId/members`

**Authentication**: Required (Team admin/owner)

**Request Body**:
```json
{
  "userId": "user-uuid",
  "teamRole": "member"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Member added successfully",
  "member": {
    "userId": "user-uuid",
    "teamRole": "member",
    "joinedAt": "2025-10-01T12:00:00Z"
  }
}
```

---

### Remove Team Member (Admin/Owner)

Remove a member from a team.

**Endpoint**: `DELETE /api/teams/:teamId/members`

**Authentication**: Required (Team admin/owner)

**Request Body**:
```json
{
  "userId": "user-uuid"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

---

## Activity Logging Endpoints

### Get Activity Logs

Retrieve activity logs.

**Endpoint**: `GET /api/activity-logs`

**Authentication**: Required

**Query Parameters**:
- `action` (optional): Filter by action type
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `page` (optional): Page number
- `limit` (optional): Results per page

**Response** (200 OK):
```json
{
  "success": true,
  "logs": [
    {
      "id": "log-uuid",
      "userId": "user-uuid",
      "action": "login_success",
      "resourceType": "authentication",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-10-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 50
  }
}
```

---

### Export Activity Logs (Admin Only)

Export activity logs for compliance.

**Endpoint**: `GET /api/activity-logs/export`

**Authentication**: Required (Admin only)

**Query Parameters**:
- `format`: csv, json, or pdf
- `startDate`: Start date
- `endDate`: End date
- `action` (optional): Filter by action

**Response**: File download

---

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": {} // Optional additional details
  }
}
```

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input or malformed request
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., email already exists)
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Common Error Codes

- `INVALID_CREDENTIALS`: Invalid login credentials
- `UNAUTHORIZED`: Not authenticated
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `ALREADY_EXISTS`: Resource already exists
- `VALIDATION_ERROR`: Input validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error

## Rate Limiting

### Limits

- **Authentication endpoints**: 5 requests per minute per IP
- **General API endpoints**: 100 requests per minute per user
- **Admin endpoints**: 200 requests per minute per admin
- **File uploads**: 10 requests per minute per user

### Rate Limit Headers

Response includes rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1633024800
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfter": 60
    }
  }
}
```

## Examples

### Example: User Registration and Login Flow

```javascript
// Register new user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe'
  })
});

const { user } = await registerResponse.json();
console.log('Registered:', user);

// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});

const loginData = await loginResponse.json();
console.log('Logged in:', loginData.user);
```

### Example: Update Profile with Avatar

```javascript
// Update profile information
const updateResponse = await fetch('/api/profile', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    bio: 'Software developer',
    timezone: 'America/New_York'
  })
});

// Upload avatar
const formData = new FormData();
formData.append('file', avatarFile);

const avatarResponse = await fetch('/api/profile/avatar', {
  method: 'POST',
  credentials: 'include',
  body: formData
});

const { avatarUrl } = await avatarResponse.json();
console.log('Avatar uploaded:', avatarUrl);
```

### Example: Check Permission and Create Content

```javascript
// Check if user can create posts
const permissionResponse = await fetch('/api/auth/permissions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    permission: 'CREATE_POST'
  })
});

const { hasPermission } = await permissionResponse.json();

if (hasPermission) {
  // Create post
  const postResponse = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      content: 'My new post',
      visibility: 'public'
    })
  });
}
```

### Example: Team Management

```javascript
// Create team (admin only)
const teamResponse = await fetch('/api/teams', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Marketing Team',
    description: 'Content creation team',
    privacy: 'private'
  })
});

const { team } = await teamResponse.json();

// Add member to team
const memberResponse = await fetch(`/api/teams/${team.id}/members`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    userId: 'user-uuid',
    teamRole: 'member'
  })
});
```

---

**Questions or issues?** Contact API support at api-support@example.com

