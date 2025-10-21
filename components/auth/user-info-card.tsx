'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Edit, Shield, Settings } from 'lucide-react';
import Link from 'next/link';

export function UserInfoCard() {
  const { user } = useAuth();
  const { profile, loading, error, getAvatarUrl, fetchProfile } = useProfile();

  // Fetch profile when component mounts and user is available
  useEffect(() => {
    if (user && !profile && !loading) {
      fetchProfile();
    }
  }, [user, profile, loading, fetchProfile]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm">Loading user info...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">
              {error || 'Unable to load user information'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayName = profile?.display_name || 
    (profile?.first_name && profile?.last_name 
      ? `${profile.first_name} ${profile.last_name}`
      : user.email?.split('@')[0] || 'User'
    );

  const roleBadgeVariant = user.role === 'ADMIN' ? 'default' : 
                           user.role === 'EDITOR' ? 'secondary' : 'outline';

  const roleDisplayName = user.role === 'ADMIN' ? 'Admin' :
                         user.role === 'EDITOR' ? 'Editor' : 'Viewer';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5" />
          User Information
        </CardTitle>
        <CardDescription>
          Your account details and permissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar and Basic Info */}
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={getAvatarUrl(48)} alt={displayName} />
            <AvatarFallback className="text-sm font-medium">
              {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {displayName}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={roleBadgeVariant} className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                {roleDisplayName}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {user.permissions.length} permissions
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {user.permissions.length}
            </div>
            <div className="text-xs text-gray-600">Permissions</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {user.role === 'ADMIN' ? 'Full' : user.role === 'EDITOR' ? 'Edit' : 'View'}
            </div>
            <div className="text-xs text-gray-600">Access Level</div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link href="/profile">
            <Button variant="outline" size="sm" className="w-full">
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </Link>
        </div>

        {/* Quick Permissions Preview */}
        {user.permissions.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-gray-600 mb-2">Key Permissions:</div>
            <div className="flex flex-wrap gap-1">
              {user.permissions.slice(0, 4).map((permission) => (
                <Badge key={permission} variant="outline" className="text-xs">
                  {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              ))}
              {user.permissions.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{user.permissions.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
