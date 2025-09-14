import { NextRequest, NextResponse } from 'next/server';
import { 
  AuthUser, 
  UserRole, 
  Permission, 
  ROLE_PERMISSIONS 
} from '@/lib/auth-types';
import { getCurrentUser } from '@/lib/auth-utils';

// Enhanced RBAC Framework Types
export interface RBACContext {
  user: AuthUser;
  resource?: string;
  resourceId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface RBACRule {
  id: string;
  name: string;
  description: string;
  conditions: RBACCondition[];
  permissions: Permission[];
  roles: UserRole[];
  priority: number;
  enabled: boolean;
}

export interface RBACCondition {
  type: 'role' | 'permission' | 'resource' | 'time' | 'location' | 'custom';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  field?: string;
}

export interface RBACDecision {
  allowed: boolean;
  reason?: string;
  rule?: RBACRule;
  context: RBACContext;
  timestamp: Date;
}

export interface RBACPolicy {
  id: string;
  name: string;
  description: string;
  rules: RBACRule[];
  defaultAction: 'allow' | 'deny';
  priority: number;
  enabled: boolean;
}

// RBAC Framework Class
export class RBACFramework {
  private policies: RBACPolicy[] = [];
  private rules: RBACRule[] = [];

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default RBAC policies
   */
  private initializeDefaultPolicies(): void {
    // Admin Policy - Full access
    const adminPolicy: RBACPolicy = {
      id: 'admin-policy',
      name: 'Administrator Policy',
      description: 'Full access policy for administrators',
      rules: [{
        id: 'admin-rule',
        name: 'Admin Full Access',
        description: 'Administrators have full access to all resources',
        conditions: [{
          type: 'role',
          operator: 'equals',
          value: UserRole.ADMIN
        }],
        permissions: Object.values(Permission),
        roles: [UserRole.ADMIN],
        priority: 100,
        enabled: true
      }],
      defaultAction: 'allow',
      priority: 100,
      enabled: true
    };

    // Editor Policy - Content management
    const editorPolicy: RBACPolicy = {
      id: 'editor-policy',
      name: 'Editor Policy',
      description: 'Content management policy for editors',
      rules: [{
        id: 'editor-rule',
        name: 'Editor Content Access',
        description: 'Editors can manage content but not users',
        conditions: [{
          type: 'role',
          operator: 'equals',
          value: UserRole.EDITOR
        }],
        permissions: [
          Permission.CREATE_POST,
          Permission.EDIT_POST,
          Permission.SCHEDULE_POST,
          Permission.VIEW_POST,
          Permission.UPLOAD_MEDIA,
          Permission.MANAGE_CONTENT,
          Permission.VIEW_ANALYTICS,
          Permission.EXPORT_DATA,
          Permission.VIEW_ENGAGEMENT_METRICS,
          Permission.VIEW_PERFORMANCE_REPORTS,
          Permission.VIEW_USERS,
          Permission.ASSIGN_TO_TEAMS,
          Permission.CREATE_AUTO_REPLIES,
          Permission.ACCESS_API
        ],
        roles: [UserRole.EDITOR],
        priority: 80,
        enabled: true
      }],
      defaultAction: 'deny',
      priority: 80,
      enabled: true
    };

    // Viewer Policy - Read-only access
    const viewerPolicy: RBACPolicy = {
      id: 'viewer-policy',
      name: 'Viewer Policy',
      description: 'Read-only access policy for viewers',
      rules: [{
        id: 'viewer-rule',
        name: 'Viewer Read Access',
        description: 'Viewers can only view content and analytics',
        conditions: [{
          type: 'role',
          operator: 'equals',
          value: UserRole.VIEWER
        }],
        permissions: [
          Permission.VIEW_POST,
          Permission.VIEW_ANALYTICS,
          Permission.VIEW_ENGAGEMENT_METRICS,
          Permission.VIEW_PERFORMANCE_REPORTS,
          Permission.VIEW_USERS,
          Permission.ASSIGN_TO_TEAMS
        ],
        roles: [UserRole.VIEWER],
        priority: 60,
        enabled: true
      }],
      defaultAction: 'deny',
      priority: 60,
      enabled: true
    };

    this.policies = [adminPolicy, editorPolicy, viewerPolicy];
    this.rules = this.policies.flatMap(policy => policy.rules);
  }

  /**
   * Evaluate access for a user and action
   */
  public async evaluateAccess(
    context: RBACContext,
    permission: Permission,
    resource?: string,
    resourceId?: string
  ): Promise<RBACDecision> {
    const decision: RBACDecision = {
      allowed: false,
      context,
      timestamp: new Date()
    };

    // Check if user has the permission through role
    if (this.hasPermissionThroughRole(context.user, permission)) {
      decision.allowed = true;
      decision.reason = `Permission granted through role: ${context.user.role}`;
      return decision;
    }

    // Check custom rules
    for (const rule of this.rules.sort((a, b) => b.priority - a.priority)) {
      if (!rule.enabled) continue;

      if (this.evaluateRule(rule, context, permission, resource, resourceId)) {
        decision.allowed = true;
        decision.reason = `Access granted by rule: ${rule.name}`;
        decision.rule = rule;
        return decision;
      }
    }

    // Check policies
    for (const policy of this.policies.sort((a, b) => b.priority - a.priority)) {
      if (!policy.enabled) continue;

      const policyDecision = this.evaluatePolicy(policy, context, permission, resource, resourceId);
      if (policyDecision.allowed) {
        decision.allowed = true;
        decision.reason = `Access granted by policy: ${policy.name}`;
        return decision;
      }
    }

    decision.reason = 'Access denied - no matching rules or policies';
    return decision;
  }

  /**
   * Check if user has permission through their role
   */
  private hasPermissionThroughRole(user: AuthUser, permission: Permission): boolean {
    return user.permissions.includes(permission);
  }

  /**
   * Evaluate a specific rule
   */
  private evaluateRule(
    rule: RBACRule,
    context: RBACContext,
    permission: Permission,
    resource?: string,
    resourceId?: string
  ): boolean {
    // Check if rule applies to this permission
    if (!rule.permissions.includes(permission)) {
      return false;
    }

    // Check if rule applies to this role
    if (!rule.roles.includes(context.user.role)) {
      return false;
    }

    // Evaluate all conditions
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context, resource, resourceId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a specific condition
   */
  private evaluateCondition(
    condition: RBACCondition,
    context: RBACContext,
    resource?: string,
    resourceId?: string
  ): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'role':
        actualValue = context.user.role;
        break;
      case 'permission':
        actualValue = context.user.permissions;
        break;
      case 'resource':
        actualValue = resource;
        break;
      case 'time':
        actualValue = new Date();
        break;
      case 'location':
        actualValue = context.metadata?.location;
        break;
      case 'custom':
        actualValue = context.metadata?.[condition.field || ''];
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, condition.value, condition.operator);
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'contains':
        return Array.isArray(actual) && actual.includes(expected);
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      default:
        return false;
    }
  }

  /**
   * Evaluate a policy
   */
  private evaluatePolicy(
    policy: RBACPolicy,
    context: RBACContext,
    permission: Permission,
    resource?: string,
    resourceId?: string
  ): RBACDecision {
    const decision: RBACDecision = {
      allowed: false,
      context,
      timestamp: new Date()
    };

    // Check if any rule in the policy allows access
    for (const rule of policy.rules) {
      if (this.evaluateRule(rule, context, permission, resource, resourceId)) {
        decision.allowed = true;
        decision.reason = `Access granted by policy rule: ${rule.name}`;
        decision.rule = rule;
        return decision;
      }
    }

    // If no rules match, use default action
    decision.allowed = policy.defaultAction === 'allow';
    decision.reason = `Default policy action: ${policy.defaultAction}`;

    return decision;
  }

  /**
   * Add a custom rule
   */
  public addRule(rule: RBACRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add a custom policy
   */
  public addPolicy(policy: RBACPolicy): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
    this.rules.push(...policy.rules);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a rule
   */
  public removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
    this.policies.forEach(policy => {
      policy.rules = policy.rules.filter(rule => rule.id !== ruleId);
    });
  }

  /**
   * Remove a policy
   */
  public removePolicy(policyId: string): void {
    const policy = this.policies.find(p => p.id === policyId);
    if (policy) {
      // Remove associated rules
      policy.rules.forEach(rule => {
        this.rules = this.rules.filter(r => r.id !== rule.id);
      });
    }
    this.policies = this.policies.filter(p => p.id !== policyId);
  }

  /**
   * Get all policies
   */
  public getPolicies(): RBACPolicy[] {
    return [...this.policies];
  }

  /**
   * Get all rules
   */
  public getRules(): RBACRule[] {
    return [...this.rules];
  }

  /**
   * Check if user can perform action on resource
   */
  public async canUserPerformAction(
    user: AuthUser,
    permission: Permission,
    resource?: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const context: RBACContext = {
      user,
      resource,
      resourceId,
      metadata
    };

    const decision = await this.evaluateAccess(context, permission, resource, resourceId);
    return decision.allowed;
  }
}

// Global RBAC instance
export const rbacFramework = new RBACFramework();

// Convenience functions
export async function canUserAccess(
  user: AuthUser,
  permission: Permission,
  resource?: string,
  resourceId?: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  return rbacFramework.canUserPerformAction(user, permission, resource, resourceId, metadata);
}

export async function evaluateUserAccess(
  user: AuthUser,
  permission: Permission,
  resource?: string,
  resourceId?: string,
  metadata?: Record<string, any>
): Promise<RBACDecision> {
  const context: RBACContext = {
    user,
    resource,
    resourceId,
    metadata
  };

  return rbacFramework.evaluateAccess(context, permission, resource, resourceId);
}

// Middleware factory for RBAC
export function createRBACMiddleware(
  permission: Permission,
  resource?: string,
  options?: {
    resourceIdExtractor?: (req: NextRequest) => string;
    metadataExtractor?: (req: NextRequest) => Record<string, any>;
    onDenied?: (req: NextRequest, decision: RBACDecision) => NextResponse;
  }
) {
  return async (request: NextRequest, handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>) => {
    try {
      const user = await getCurrentUser(request);
      
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const resourceId = options?.resourceIdExtractor?.(request);
      const metadata = options?.metadataExtractor?.(request);

      const decision = await evaluateUserAccess(
        user,
        permission,
        resource,
        resourceId,
        metadata
      );

      if (!decision.allowed) {
        if (options?.onDenied) {
          return options.onDenied(request, decision);
        }

        return NextResponse.json(
          { 
            error: 'Access denied',
            reason: decision.reason,
            requiredPermission: permission,
            userRole: user.role
          },
          { status: 403 }
        );
      }

      return handler(request, user);
    } catch (error) {
      console.error('RBAC middleware error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
