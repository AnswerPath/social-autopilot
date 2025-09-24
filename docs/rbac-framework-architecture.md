# Role-Based Access Control (RBAC) Framework Architecture

## Overview

The RBAC Framework provides a comprehensive, flexible, and secure access control system for the Social AutoPilot application. It supports dynamic role management, granular permissions, context-aware authorization, and audit logging.

## Architecture Components

### 1. Core Types and Interfaces

#### UserRole Enum
```typescript
export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR', 
  VIEWER = 'VIEWER'
}
```

#### Permission Enum
Comprehensive set of permissions covering all application features:
- **Post Management**: CREATE_POST, EDIT_POST, DELETE_POST, PUBLISH_POST, SCHEDULE_POST
- **Content Management**: UPLOAD_MEDIA, MANAGE_MEDIA, EDIT_MEDIA, DELETE_MEDIA
- **Analytics & Reporting**: VIEW_ANALYTICS, EXPORT_REPORTS, VIEW_ENGAGEMENT, VIEW_REACH
- **User Management**: MANAGE_USERS, ASSIGN_ROLES, VIEW_USERS, DELETE_USERS
- **Settings & Configuration**: MANAGE_SETTINGS, MANAGE_INTEGRATIONS, VIEW_SETTINGS, MANAGE_BRANDING
- **Team Management**: MANAGE_TEAM, INVITE_MEMBERS, REMOVE_MEMBERS, VIEW_TEAM
- **Automation**: MANAGE_AUTOMATION, VIEW_AUTOMATION, DELETE_AUTOMATION, SCHEDULE_AUTOMATION
- **Billing & Subscription**: MANAGE_BILLING, VIEW_BILLING, MANAGE_SUBSCRIPTION, VIEW_SUBSCRIPTION
- **API Access**: API_READ, API_WRITE, API_DELETE, MANAGE_API_KEYS

#### ROLE_PERMISSIONS Mapping
Defines which permissions each role has:
- **ADMIN**: All permissions
- **EDITOR**: Content and analytics permissions
- **VIEWER**: Read-only permissions

### 2. Enhanced RBAC Framework

#### RBACFramework Class
The core framework class that provides:

**Policy Management**:
- Default policies for each role (Admin, Editor, Viewer)
- Custom policy creation and management
- Policy priority and conflict resolution

**Rule Evaluation**:
- Condition-based access control
- Context-aware permission checking
- Resource-specific permissions

**Access Decision Engine**:
- Evaluates user access requests
- Provides detailed decision reasoning
- Supports audit logging

#### Key Features

**Context-Aware Authorization**:
```typescript
interface RBACContext {
  user: AuthUser;
  resource?: string;
  resourceId?: string;
  action?: string;
  metadata?: Record<string, any>;
}
```

**Flexible Condition System**:
- Role-based conditions
- Permission-based conditions
- Resource-based conditions
- Time-based conditions
- Location-based conditions
- Custom conditions

**Priority-Based Evaluation**:
- Rules and policies have priority levels
- Higher priority rules override lower priority ones
- Default actions for unmatched requests

### 3. API Endpoints

#### Role Management (`/api/auth/roles`)
- `GET`: List all available roles and permissions
- `POST`: Create custom roles
- `PUT`: Update existing roles
- `DELETE`: Delete custom roles

#### User Role Management (`/api/auth/users/roles`)
- `GET`: Get user roles and permissions
- `POST`: Assign roles to users
- `DELETE`: Remove roles from users

#### Permission Management (`/api/auth/permissions`)
- `GET`: List all permissions and categories
- `POST`: Check specific permissions

#### User Management (`/api/auth/users`)
- `GET`: List all users with their roles (Admin only)

### 4. Client-Side Components

#### RoleManagementDashboard
Comprehensive admin interface for:
- Creating and managing custom roles
- Assigning roles to users
- Viewing permission categories
- Monitoring role assignments

#### PermissionGate Components
- `PermissionGate`: Generic permission-based rendering
- `PermissionButton`: Permission-gated buttons
- `PermissionSection`: Permission-gated sections
- Convenience components: `CanCreatePost`, `CanViewAnalytics`, etc.

#### ProtectedRoute Components
- `ProtectedRoute`: Route-level protection
- `AdminOnly`: Admin-only routes
- `EditorOnly`: Editor-only routes

### 5. Hooks and Utilities

#### useRoleManagement Hook
Provides comprehensive role management functionality:
- Role creation, updating, and deletion
- User role assignment and removal
- Permission checking
- Data refresh and error handling

#### usePermissionCheck Hook
Simplified permission checking:
- Single permission verification
- Loading states and error handling

#### useRoleInfo Hook
User role information retrieval:
- Current user role details
- Permission lists
- Assignment history

### 6. Database Schema

#### Core Tables

**user_roles**:
```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id)
);
```

**custom_roles** (for future expansion):
```sql
CREATE TABLE custom_roles (
  role_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**permission_audit_logs**:
```sql
CREATE TABLE permission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  reason TEXT,
  context JSONB,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 7. Security Features

#### Authentication Integration
- Seamless integration with Supabase Auth
- JWT token-based authentication
- Session management and validation

#### Authorization Layers
1. **Route Protection**: Middleware-level access control
2. **API Protection**: Server-side permission validation
3. **UI Protection**: Client-side component gating
4. **Database Protection**: Row Level Security (RLS) policies

#### Audit Logging
- Comprehensive permission check logging
- User action tracking
- Security event monitoring
- Compliance reporting

#### Rate Limiting
- Brute force protection
- API abuse prevention
- Resource usage monitoring

### 8. Performance Optimizations

#### Caching
- Permission result caching
- Role information caching
- Configurable cache expiry

#### Database Optimization
- Indexed queries for role lookups
- Efficient permission checking
- Minimal database round trips

#### Client-Side Optimization
- Lazy loading of role management components
- Efficient re-rendering with React hooks
- Optimized API calls

### 9. Integration Points

#### Authentication System
- User registration and login
- Session management
- Password reset flows

#### User Profile System
- Profile creation and management
- Account settings
- Avatar management

#### Audit System
- Activity logging
- Security event tracking
- Compliance reporting

### 10. Configuration and Customization

#### Environment Configuration
- Role definitions
- Permission mappings
- Security policies

#### Runtime Configuration
- Custom role creation
- Permission modifications
- Policy adjustments

#### Deployment Considerations
- Database migrations
- Environment variables
- Security settings

## Usage Examples

### Basic Permission Check
```typescript
import { useAuth } from '@/hooks/use-auth';
import { Permission } from '@/lib/auth-types';

function MyComponent() {
  const { user } = useAuth();
  
  if (!user) return <div>Please log in</div>;
  
  const canCreatePosts = user.permissions.includes(Permission.CREATE_POST);
  
  return (
    <div>
      {canCreatePosts && <CreatePostButton />}
    </div>
  );
}
```

### Using PermissionGate
```typescript
import { PermissionGate } from '@/components/auth/permission-gate';
import { Permission } from '@/lib/auth-types';

function Dashboard() {
  return (
    <div>
      <PermissionGate permission={Permission.CREATE_POST}>
        <CreatePostForm />
      </PermissionGate>
      
      <PermissionGate permission={Permission.VIEW_ANALYTICS}>
        <AnalyticsWidget />
      </PermissionGate>
    </div>
  );
}
```

### Server-Side Authorization
```typescript
import { requirePermission } from '@/lib/auth-utils';
import { Permission } from '@/lib/auth-types';

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, Permission.CREATE_POST);
  
  // User is guaranteed to have CREATE_POST permission
  // Proceed with post creation logic
}
```

### Role Management
```typescript
import { useRoleManagement } from '@/hooks/use-role-management';

function RoleManager() {
  const { createRole, assignRole, roles, users } = useRoleManagement();
  
  const handleCreateRole = async () => {
    await createRole({
      name: 'Content Manager',
      description: 'Manages content but not users',
      permissions: [Permission.CREATE_POST, Permission.EDIT_POST]
    });
  };
  
  return (
    <div>
      {roles.map(role => (
        <RoleCard key={role.id} role={role} />
      ))}
    </div>
  );
}
```

## Security Considerations

### Best Practices
1. **Principle of Least Privilege**: Users get minimum required permissions
2. **Defense in Depth**: Multiple authorization layers
3. **Audit Everything**: Comprehensive logging of access decisions
4. **Regular Review**: Periodic permission audits
5. **Secure Defaults**: Deny by default, explicit allow

### Threat Mitigation
1. **Privilege Escalation**: Role-based access prevents unauthorized escalation
2. **Data Leakage**: Permission gates prevent unauthorized data access
3. **Unauthorized Actions**: Server-side validation prevents client-side bypass
4. **Session Hijacking**: Secure session management with token validation

## Future Enhancements

### Planned Features
1. **Dynamic Permissions**: Runtime permission modifications
2. **Resource-Level Permissions**: Fine-grained resource access control
3. **Time-Based Access**: Temporary permission grants
4. **Location-Based Access**: Geographic access restrictions
5. **Multi-Tenant Support**: Organization-level role management

### Scalability Considerations
1. **Distributed Caching**: Redis-based permission caching
2. **Microservice Architecture**: Service-specific authorization
3. **Event-Driven Updates**: Real-time permission synchronization
4. **Performance Monitoring**: Authorization performance metrics

## Conclusion

The RBAC Framework provides a robust, scalable, and secure foundation for access control in the Social AutoPilot application. It balances flexibility with security, providing comprehensive role and permission management while maintaining excellent performance and user experience.

The framework is designed to grow with the application, supporting both current requirements and future enhancements in access control and security.

