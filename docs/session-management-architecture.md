# Session and Token Management Architecture

## Overview

This document describes the comprehensive session and token management system implemented for the Social AutoPilot application. The system provides secure, scalable, and feature-rich session handling with advanced security monitoring and token management capabilities.

## Architecture Components

### 1. JWT Token Management (`lib/jwt-utils.ts`)

**Purpose**: Handles JWT token validation, refresh, and revocation operations.

**Key Features**:
- Token validation with expiry checking
- Automatic token refresh when near expiry
- Token revocation for security incidents
- Secure token parsing and user ID extraction
- Token validation middleware for API routes

**Core Functions**:
- `validateAccessToken()` - Validates JWT tokens and checks expiry
- `refreshAccessToken()` - Refreshes expired tokens using refresh tokens
- `revokeRefreshToken()` - Revokes refresh tokens (logout)
- `revokeAllUserTokens()` - Emergency token revocation for security incidents
- `createTokenValidationMiddleware()` - Middleware for automatic token validation

### 2. Enhanced Session Management (`lib/session-management.ts`)

**Purpose**: Provides comprehensive session tracking, security monitoring, and analytics.

**Key Features**:
- Enhanced session creation with security checks
- Device and browser detection
- IP address tracking and location detection
- Session activity monitoring
- Security event detection and logging
- Session analytics and reporting
- Concurrent session management

**Core Functions**:
- `createEnhancedSession()` - Creates sessions with security checks
- `updateSessionActivity()` - Updates activity with security monitoring
- `getSessionDetails()` - Retrieves detailed session information
- `getUserSessionsDetailed()` - Gets all user sessions with device info
- `getSessionAnalytics()` - Provides session analytics and metrics
- `deactivateSession()` - Deactivates specific sessions
- `deactivateOtherSessions()` - Deactivates all other user sessions
- `cleanupExpiredSessions()` - Cleans up expired sessions

### 3. API Endpoints

#### Token Refresh (`/api/auth/refresh`)
- **POST**: Refreshes access tokens with security checks
- **GET**: Checks token status without refreshing
- Rate limited to prevent abuse
- Automatic session activity updates

#### Session Management (`/api/auth/sessions`)
- **GET**: Retrieves user sessions with analytics
- **DELETE**: Deactivates specific or all other sessions
- **POST**: Admin cleanup operations
- Comprehensive session information

#### Token Revocation (`/api/auth/revoke`)
- **POST**: Revokes tokens and sessions for security incidents
- **GET**: Gets revocation status
- Supports multiple revocation strategies
- Emergency revocation for admins

### 4. Client-Side Integration

#### Session Monitoring Component (`components/auth/session-monitoring.tsx`)
- Real-time session monitoring dashboard
- Device and browser information display
- Session analytics and metrics
- Security recommendations
- Session management actions

#### Session Management Hook (`hooks/use-session-management.tsx`)
- React hook for session management
- Automatic token status checking
- Session data management
- Token refresh automation
- Real-time session updates

## Security Features

### 1. Rate Limiting
- **Token Refresh**: 20 requests per 5 minutes
- **Login Attempts**: 5 attempts per 15 minutes
- **Password Reset**: 3 requests per hour
- **General API**: 100 requests per 15 minutes

### 2. Session Security
- **Concurrent Session Limits**: Maximum 5 active sessions per user
- **IP Address Tracking**: Monitors for unusual location changes
- **Device Change Detection**: Alerts on user agent changes
- **Session Timeout**: Automatic session expiry after 30 days
- **Activity Monitoring**: Tracks last activity timestamps

### 3. Token Security
- **Automatic Refresh**: Tokens refresh when near expiry (5 minutes)
- **Secure Storage**: HTTP-only cookies with secure flags
- **Token Revocation**: Immediate revocation for security incidents
- **Expiry Management**: Proper token lifecycle management

### 4. Security Monitoring
- **Suspicious Activity Detection**: Monitors for unusual patterns
- **Security Event Logging**: Comprehensive audit trail
- **Real-time Alerts**: Immediate notification of security events
- **Session Analytics**: Detailed security metrics

## Database Schema

### User Sessions Table
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### Security Events (Future Enhancement)
```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  details JSONB,
  severity TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Configuration

### Session Configuration
```typescript
const SESSION_CONFIG = {
  accessTokenExpiry: 60 * 60, // 1 hour
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  sessionIdExpiry: 30 * 24 * 60 * 60, // 30 days
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  }
}
```

### Rate Limiting Configuration
```typescript
const RATE_LIMIT_CONFIG = {
  tokenRefresh: {
    maxAttempts: 20,
    windowMs: 5 * 60 * 1000, // 5 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
  },
  loginAttempts: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  }
}
```

## Usage Examples

### 1. Basic Session Management
```typescript
import { useSessionManagement } from '@/hooks/use-session-management';

function MyComponent() {
  const { 
    sessions, 
    currentSession, 
    revokeSession, 
    refreshSessions 
  } = useSessionManagement();

  return (
    <div>
      <h2>Active Sessions: {sessions.length}</h2>
      {sessions.map(session => (
        <div key={session.session_id}>
          {session.device_type} - {session.browser}
          <button onClick={() => revokeSession(session.session_id)}>
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Token Status Monitoring
```typescript
import { useSessionManagement } from '@/hooks/use-session-management';

function TokenStatus() {
  const { tokenStatus, isTokenExpired, needsTokenRefresh } = useSessionManagement();

  if (isTokenExpired) {
    return <div>Session expired. Please log in again.</div>;
  }

  if (needsTokenRefresh) {
    return <div>Refreshing session...</div>;
  }

  return <div>Session active until {new Date(tokenStatus.expiresAt).toLocaleString()}</div>;
}
```

### 3. Security Monitoring
```typescript
import { SessionMonitoring } from '@/components/auth/session-monitoring';

function SecurityDashboard() {
  return (
    <div>
      <h1>Security Dashboard</h1>
      <SessionMonitoring userId={user.id} />
    </div>
  );
}
```

## Security Best Practices

### 1. Session Management
- Regularly review active sessions
- Revoke sessions from unknown devices
- Monitor for concurrent session limits
- Implement session timeout policies

### 2. Token Security
- Use secure cookie storage
- Implement proper token refresh logic
- Monitor for token abuse patterns
- Implement emergency revocation procedures

### 3. Monitoring and Alerting
- Set up security event monitoring
- Implement real-time alerting for suspicious activity
- Regular security audit reviews
- Monitor rate limiting effectiveness

## Future Enhancements

### 1. Advanced Security Features
- Machine learning-based anomaly detection
- Geographic location validation
- Device fingerprinting
- Biometric authentication integration

### 2. Analytics and Reporting
- Detailed session analytics dashboard
- Security incident reporting
- User behavior analytics
- Performance monitoring

### 3. Integration Features
- Single Sign-On (SSO) integration
- Multi-factor authentication
- OAuth provider integration
- Enterprise security compliance

## Troubleshooting

### Common Issues

1. **Token Refresh Failures**
   - Check rate limiting configuration
   - Verify refresh token validity
   - Monitor for concurrent session limits

2. **Session Management Issues**
   - Verify database connectivity
   - Check session cleanup processes
   - Monitor for expired session accumulation

3. **Security Alert False Positives**
   - Adjust security thresholds
   - Review IP address whitelisting
   - Update device detection logic

### Monitoring and Debugging

1. **Enable Debug Logging**
   ```typescript
   // Set environment variable
   SESSION_DEBUG=true
   ```

2. **Monitor Rate Limiting**
   - Check rate limit headers in API responses
   - Monitor rate limit store for blocked clients
   - Review rate limit configuration effectiveness

3. **Session Analytics**
   - Use session analytics API for insights
   - Monitor session duration patterns
   - Track security event frequency

## Conclusion

The session and token management system provides a robust, secure, and scalable foundation for user authentication and session handling. With comprehensive security monitoring, automatic token management, and detailed analytics, the system ensures both security and user experience are optimized.

The modular architecture allows for easy extension and customization while maintaining security best practices and performance optimization.
