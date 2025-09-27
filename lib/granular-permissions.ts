import { 
  AuthUser, 
  Permission, 
  UserRole, 
  ROLE_PERMISSIONS,
  ResourcePermission,
  PermissionOverride,
  CustomPermission,
  PermissionContext,
  PermissionCondition
} from '@/lib/auth-types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auth-utils';

/**
 * Granular Permission Service
 * Handles resource-based permissions, custom permissions, and dynamic evaluation
 */
export class GranularPermissionService {
  private static instance: GranularPermissionService;

  public static getInstance(): GranularPermissionService {
    if (!GranularPermissionService.instance) {
      GranularPermissionService.instance = new GranularPermissionService();
    }
    return GranularPermissionService.instance;
  }

  /**
   * Check if user has permission with granular evaluation
   */
  async hasPermission(
    context: PermissionContext,
    permission: Permission,
    resourceType?: string,
    resourceId?: string
  ): Promise<{
    allowed: boolean;
    reason: string;
    source: 'role' | 'custom' | 'resource' | 'override' | 'denied';
    details?: any;
  }> {
    try {
      // 1. Check for explicit deny overrides first
      const denyOverride = await this.checkPermissionOverrides(
        context.user.id,
        permission,
        'deny',
        resourceType,
        resourceId
      );
      
      if (denyOverride) {
        await this.logPermissionCheck(context, permission, false, 'deny_override', {
          override_id: denyOverride.id,
          reason: denyOverride.reason
        });
        
        return {
          allowed: false,
          reason: `Permission denied by override: ${denyOverride.reason}`,
          source: 'denied'
        };
      }

      // 2. Check role-based permissions
      if (this.hasRolePermission(context.user, permission)) {
        await this.logPermissionCheck(context, permission, true, 'role', {
          role: context.user.role
        });
        
        return {
          allowed: true,
          reason: `Permission granted by role: ${context.user.role}`,
          source: 'role'
        };
      }

      // 3. Check custom permissions
      const customPermission = await this.checkCustomPermissions(
        context.user.id,
        permission,
        resourceType
      );
      
      if (customPermission) {
        await this.logPermissionCheck(context, permission, true, 'custom', {
          custom_permission_id: customPermission.id
        });
        
        return {
          allowed: true,
          reason: `Permission granted by custom permission: ${customPermission.name}`,
          source: 'custom',
          details: customPermission
        };
      }

      // 4. Check resource-specific permissions
      if (resourceType && resourceId) {
        const resourcePermission = await this.checkResourcePermissions(
          context.user.id,
          permission,
          resourceType,
          resourceId
        );
        
        if (resourcePermission) {
          await this.logPermissionCheck(context, permission, true, 'resource', {
            resource_permission_id: resourcePermission.id
          });
          
          return {
            allowed: true,
            reason: `Permission granted by resource permission`,
            source: 'resource',
            details: resourcePermission
          };
        }
      }

      // 5. Check grant overrides
      const grantOverride = await this.checkPermissionOverrides(
        context.user.id,
        permission,
        'grant',
        resourceType,
        resourceId
      );
      
      if (grantOverride) {
        await this.logPermissionCheck(context, permission, true, 'override', {
          override_id: grantOverride.id,
          reason: grantOverride.reason
        });
        
        return {
          allowed: true,
          reason: `Permission granted by override: ${grantOverride.reason}`,
          source: 'override',
          details: grantOverride
        };
      }

      // 6. Check ownership-based permissions
      const ownershipCheck = await this.checkOwnershipPermissions(
        context,
        permission,
        resourceType,
        resourceId
      );
      
      if (ownershipCheck.allowed) {
        await this.logPermissionCheck(context, permission, true, 'ownership', ownershipCheck.details);
        return ownershipCheck;
      }

      // 7. Default deny
      await this.logPermissionCheck(context, permission, false, 'default_deny');
      
      return {
        allowed: false,
        reason: 'Permission not granted by any rule',
        source: 'denied'
      };

    } catch (error) {
      console.error('Permission check error:', error);
      
      await this.logPermissionCheck(context, permission, false, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        allowed: false,
        reason: 'Permission check failed due to system error',
        source: 'denied'
      };
    }
  }

  /**
   * Check if user has permission through their role
   */
  private hasRolePermission(user: AuthUser, permission: Permission): boolean {
    return user.permissions.includes(permission);
  }

  /**
   * Check custom permissions for user
   */
  private async checkCustomPermissions(
    userId: string,
    permission: Permission,
    resourceType?: string
  ): Promise<CustomPermission | null> {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('custom_permissions')
      .select(`
        *,
        user_custom_permissions!inner(
          user_id,
          is_active
        )
      `)
      .eq('user_custom_permissions.user_id', userId)
      .eq('user_custom_permissions.is_active', true)
      .contains('permissions', [permission]);

    if (error) {
      console.error('Error checking custom permissions:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Check if resource type matches (if specified)
    const customPermission = data[0];
    if (resourceType && customPermission.resource_types) {
      if (!customPermission.resource_types.includes(resourceType)) {
        return null;
      }
    }

    return customPermission;
  }

  /**
   * Check resource-specific permissions
   */
  private async checkResourcePermissions(
    userId: string,
    permission: Permission,
    resourceType: string,
    resourceId: string
  ): Promise<ResourcePermission | null> {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('resource_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('permission', permission)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (error) {
      console.error('Error checking resource permissions:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const resourcePermission = data[0];
    
    // Check conditions if any
    if (resourcePermission.conditions) {
      const conditionsMet = await this.evaluateConditions(
        resourcePermission.conditions,
        resourceType,
        resourceId
      );
      
      if (!conditionsMet) {
        return null;
      }
    }

    return resourcePermission;
  }

  /**
   * Check permission overrides
   */
  private async checkPermissionOverrides(
    userId: string,
    permission: Permission,
    action: 'grant' | 'deny',
    resourceType?: string,
    resourceId?: string
  ): Promise<PermissionOverride | null> {
    const supabase = getSupabaseAdmin();
    
    let query = supabase
      .from('permission_overrides')
      .select('*')
      .eq('user_id', userId)
      .eq('permission', permission)
      .eq('action', action)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }
    
    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking permission overrides:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Check ownership-based permissions
   */
  private async checkOwnershipPermissions(
    context: PermissionContext,
    permission: Permission,
    resourceType?: string,
    resourceId?: string
  ): Promise<{ allowed: boolean; reason: string; source: string; details?: any }> {
    // Check if this is an "own" permission
    if (permission.includes('OWN')) {
      if (!resourceType || !resourceId) {
        return {
          allowed: false,
          reason: 'Ownership check requires resource type and ID',
          source: 'denied'
        };
      }

      // Check if user owns the resource
      const isOwner = await this.checkResourceOwnership(
        context.user.id,
        resourceType,
        resourceId
      );

      if (isOwner) {
        return {
          allowed: true,
          reason: `Permission granted through ownership of ${resourceType}`,
          source: 'ownership',
          details: { resource_type: resourceType, resource_id: resourceId }
        };
      }
    }

    return {
      allowed: false,
      reason: 'Not an ownership permission or user does not own resource',
      source: 'denied'
    };
  }

  /**
   * Check if user owns a specific resource
   */
  private async checkResourceOwnership(
    userId: string,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    
    try {
      let tableName: string;
      let ownerField: string;

      switch (resourceType) {
        case 'post':
          tableName = 'scheduled_posts';
          ownerField = 'author_id';
          break;
        case 'media':
          tableName = 'media_files';
          ownerField = 'uploaded_by';
          break;
        case 'automation':
          tableName = 'automation_rules';
          ownerField = 'created_by';
          break;
        case 'team':
          tableName = 'teams';
          ownerField = 'owner_id';
          break;
        default:
          return false;
      }

      const { data, error } = await supabase
        .from(tableName)
        .select(ownerField)
        .eq('id', resourceId)
        .single();

      if (error || !data) {
        return false;
      }

      return data[ownerField] === userId;

    } catch (error) {
      console.error('Error checking resource ownership:', error);
      return false;
    }
  }

  /**
   * Evaluate permission conditions
   */
  private async evaluateConditions(
    conditions: PermissionCondition[],
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    for (const condition of conditions) {
      const met = await this.evaluateCondition(condition, resourceType, resourceId);
      if (!met) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: PermissionCondition,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    switch (condition.type) {
      case 'time':
        return this.evaluateTimeCondition(condition);
      case 'location':
        return this.evaluateLocationCondition(condition);
      case 'device':
        return this.evaluateDeviceCondition(condition);
      case 'ip':
        return this.evaluateIpCondition(condition);
      case 'custom':
        return this.evaluateCustomCondition(condition, resourceType, resourceId);
      default:
        return false;
    }
  }

  /**
   * Evaluate time-based conditions
   */
  private evaluateTimeCondition(condition: PermissionCondition): boolean {
    const now = new Date();
    const conditionTime = new Date(condition.value);

    switch (condition.operator) {
      case 'greater_than':
        return now > conditionTime;
      case 'less_than':
        return now < conditionTime;
      case 'equals':
        return Math.abs(now.getTime() - conditionTime.getTime()) < 60000; // Within 1 minute
      default:
        return false;
    }
  }

  /**
   * Evaluate location-based conditions (placeholder)
   */
  private evaluateLocationCondition(condition: PermissionCondition): boolean {
    // Implement location-based permission logic
    // This would typically check user's IP geolocation or GPS coordinates
    return true; // Placeholder
  }

  /**
   * Evaluate device-based conditions (placeholder)
   */
  private evaluateDeviceCondition(condition: PermissionCondition): boolean {
    // Implement device-based permission logic
    // This would check user agent, device type, etc.
    return true; // Placeholder
  }

  /**
   * Evaluate IP-based conditions (placeholder)
   */
  private evaluateIpCondition(condition: PermissionCondition): boolean {
    // Implement IP-based permission logic
    // This would check if user's IP is in allowed ranges
    return true; // Placeholder
  }

  /**
   * Evaluate custom conditions
   */
  private async evaluateCustomCondition(
    condition: PermissionCondition,
    resourceType: string,
    resourceId: string
  ): Promise<boolean> {
    // Implement custom condition evaluation logic
    // This could query database, call external APIs, etc.
    return true; // Placeholder
  }

  /**
   * Log permission check for audit
   */
  private async logPermissionCheck(
    context: PermissionContext,
    permission: Permission,
    allowed: boolean,
    source: string,
    details?: any
  ): Promise<void> {
    try {
      await logAuditEvent({
        user_id: context.user.id,
        action: 'PERMISSION_CHECKED',
        resource_type: 'permission',
        resource_id: permission,
        details: {
          permission,
          allowed,
          source,
          resource_type: context.resource_type,
          resource_id: context.resource_id,
          action: context.action,
          ip_address: context.ip_address,
          user_agent: context.user_agent,
          ...details
        }
      });
    } catch (error) {
      console.error('Error logging permission check:', error);
    }
  }

  /**
   * Grant resource permission to user
   */
  async grantResourcePermission(
    userId: string,
    permission: Permission,
    resourceType: string,
    resourceId: string,
    grantedBy: string,
    expiresAt?: string,
    conditions?: PermissionCondition[]
  ): Promise<ResourcePermission> {
    const supabase = getSupabaseAdmin();
    
    const resourcePermission: Omit<ResourcePermission, 'id'> = {
      permission,
      resource_type: resourceType,
      resource_id: resourceId,
      user_id: userId,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt,
      conditions,
      is_active: true
    };

    const { data, error } = await supabase
      .from('resource_permissions')
      .insert(resourcePermission)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to grant resource permission: ${error.message}`);
    }

    await logAuditEvent({
      user_id: grantedBy,
      action: 'RESOURCE_PERMISSION_GRANTED',
      resource_type: 'resource_permission',
      resource_id: data.id,
      details: {
        target_user: userId,
        permission,
        resource_type: resourceType,
        resource_id: resourceId,
        expires_at: expiresAt
      }
    });

    return data;
  }

  /**
   * Revoke resource permission from user
   */
  async revokeResourcePermission(
    permissionId: string,
    revokedBy: string
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('resource_permissions')
      .update({ is_active: false })
      .eq('id', permissionId);

    if (error) {
      throw new Error(`Failed to revoke resource permission: ${error.message}`);
    }

    await logAuditEvent({
      user_id: revokedBy,
      action: 'RESOURCE_PERMISSION_REVOKED',
      resource_type: 'resource_permission',
      resource_id: permissionId,
      details: {
        permission_id: permissionId
      }
    });
  }

  /**
   * Create permission override
   */
  async createPermissionOverride(
    userId: string,
    permission: Permission,
    action: 'grant' | 'deny',
    reason: string,
    grantedBy: string,
    resourceType?: string,
    resourceId?: string,
    expiresAt?: string
  ): Promise<PermissionOverride> {
    const supabase = getSupabaseAdmin();
    
    const permissionOverride: Omit<PermissionOverride, 'id'> = {
      user_id: userId,
      permission,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      reason,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_active: true
    };

    const { data, error } = await supabase
      .from('permission_overrides')
      .insert(permissionOverride)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create permission override: ${error.message}`);
    }

    await logAuditEvent({
      user_id: grantedBy,
      action: 'PERMISSION_OVERRIDE_CREATED',
      resource_type: 'permission_override',
      resource_id: data.id,
      details: {
        target_user: userId,
        permission,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        reason
      }
    });

    return data;
  }

  /**
   * Get user's effective permissions
   */
  async getUserEffectivePermissions(
    userId: string,
    resourceType?: string,
    resourceId?: string
  ): Promise<{
    rolePermissions: Permission[];
    customPermissions: CustomPermission[];
    resourcePermissions: ResourcePermission[];
    overrides: PermissionOverride[];
  }> {
    const supabase = getSupabaseAdmin();
    
    // Get user's role permissions
    const { data: userData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const rolePermissions = userData ? ROLE_PERMISSIONS[userData.role as UserRole] || [] : [];

    // Get custom permissions
    const { data: customPermissions } = await supabase
      .from('custom_permissions')
      .select(`
        *,
        user_custom_permissions!inner(
          user_id,
          is_active
        )
      `)
      .eq('user_custom_permissions.user_id', userId)
      .eq('user_custom_permissions.is_active', true);

    // Get resource permissions
    let resourcePermissionsQuery = supabase
      .from('resource_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (resourceType) {
      resourcePermissionsQuery = resourcePermissionsQuery.eq('resource_type', resourceType);
    }
    
    if (resourceId) {
      resourcePermissionsQuery = resourcePermissionsQuery.eq('resource_id', resourceId);
    }

    const { data: resourcePermissions } = await resourcePermissionsQuery;

    // Get permission overrides
    let overridesQuery = supabase
      .from('permission_overrides')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if (resourceType) {
      overridesQuery = overridesQuery.eq('resource_type', resourceType);
    }
    
    if (resourceId) {
      overridesQuery = overridesQuery.eq('resource_id', resourceId);
    }

    const { data: overrides } = await overridesQuery;

    return {
      rolePermissions,
      customPermissions: customPermissions || [],
      resourcePermissions: resourcePermissions || [],
      overrides: overrides || []
    };
  }
}

// Export singleton instance
export const granularPermissionService = GranularPermissionService.getInstance();

// Convenience functions
export async function hasPermission(
  context: PermissionContext,
  permission: Permission,
  resourceType?: string,
  resourceId?: string
): Promise<boolean> {
  const result = await granularPermissionService.hasPermission(context, permission, resourceType, resourceId);
  return result.allowed;
}

export async function checkPermission(
  context: PermissionContext,
  permission: Permission,
  resourceType?: string,
  resourceId?: string
) {
  return granularPermissionService.hasPermission(context, permission, resourceType, resourceId);
}
