'use client';
import React from 'react';
import { useProfile } from '@/hooks/use-profile';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, User, Edit, Mail, Calendar, Clock, Bell } from 'lucide-react';

interface ProfileViewProps {
  onEdit?: () => void;
}

export function ProfileView({ onEdit }: ProfileViewProps) {
  const { user } = useAuth();
  const { profile, loading, error, getAvatarUrl } = useProfile();

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading profile...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-red-600">Error loading profile: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Your personal information and account details
            </CardDescription>
          </div>
          {onEdit && (
            <Button onClick={onEdit} variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-start space-x-4">
            <img
              src={getAvatarUrl(80)}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover border-2 border-border"
            />
            <div className="flex-1">
              <h3 className="text-xl font-semibold">
                {profile?.display_name || 'No display name set'}
              </h3>
              <p className="text-muted-foreground">
                {profile?.first_name && profile?.last_name 
                  ? `${profile.first_name} ${profile.last_name}`
                  : 'Name not set'
                }
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="capitalize">
                  {user?.role}
                </Badge>
                <Badge variant="outline">
                  {user?.permissions.length} permissions
                </Badge>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              {profile?.timezone && (
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Timezone</p>
                    <p className="text-sm text-muted-foreground">{profile.timezone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div>
              <h4 className="font-medium text-foreground mb-2">Bio</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Preferences */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Preferences</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications for important updates
                    </p>
                  </div>
                </div>
                <Badge variant={profile?.email_notifications ? "default" : "secondary"}>
                  {profile?.email_notifications ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Account Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Member Since</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.created_at 
                      ? new Date(profile.created_at).toLocaleDateString()
                      : 'Unknown'
                    }
                  </p>
                </div>
              </div>
              {profile?.updated_at && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(profile.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Permissions Summary */}
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Permissions</h4>
            <div className="flex flex-wrap gap-2">
              {user?.permissions.slice(0, 6).map((permission) => (
                <Badge key={permission} variant="outline" className="text-xs">
                  {permission}
                </Badge>
              ))}
              {user?.permissions.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{user.permissions.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
