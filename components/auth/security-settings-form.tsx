'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountSettings } from '@/hooks/use-account-settings';
import { SecuritySettings } from '@/lib/auth-types';
import { Loader2, Shield, Lock, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const SecuritySettingsSchema = z.object({
  two_factor_enabled: z.boolean(),
  login_notifications: z.boolean(),
  session_timeout_minutes: z.number().min(5).max(1440),
  require_password_for_sensitive_actions: z.boolean(),
});

type SecuritySettingsFormData = z.infer<typeof SecuritySettingsSchema>;

export function SecuritySettingsForm() {
  const { settings, updateSecuritySettings, loading } = useAccountSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SecuritySettingsFormData>({
    resolver: zodResolver(SecuritySettingsSchema),
    defaultValues: {
      two_factor_enabled: false,
      login_notifications: true,
      session_timeout_minutes: 60,
      require_password_for_sensitive_actions: true,
    },
  });

  useEffect(() => {
    if (settings?.security_settings) {
      form.reset(settings.security_settings);
    }
  }, [settings, form]);

  const onSubmit = async (data: SecuritySettingsFormData) => {
    setIsSubmitting(true);
    try {
      await updateSecuritySettings(data);
      toast.success('Security settings updated successfully');
    } catch (error) {
      toast.error('Failed to update security settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSessionTimeoutOptions = () => {
    return [
      { value: 5, label: '5 minutes' },
      { value: 15, label: '15 minutes' },
      { value: 30, label: '30 minutes' },
      { value: 60, label: '1 hour' },
      { value: 120, label: '2 hours' },
      { value: 240, label: '4 hours' },
      { value: 480, label: '8 hours' },
      { value: 1440, label: '24 hours' },
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading security settings...</span>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="two_factor_enabled">Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require a second form of verification when logging in
              </p>
            </div>
            <Switch
              id="two_factor_enabled"
              checked={form.watch('two_factor_enabled')}
              onCheckedChange={(checked) => form.setValue('two_factor_enabled', checked)}
            />
          </div>
          
          {form.watch('two_factor_enabled') && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Two-factor authentication is enabled</p>
                  <p className="mt-1">
                    You'll need to enter a verification code from your authenticator app when logging in.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Login Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Login Notifications
          </CardTitle>
          <CardDescription>
            Get notified about login attempts and suspicious activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="login_notifications">Login Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications for new login attempts
              </p>
            </div>
            <Switch
              id="login_notifications"
              checked={form.watch('login_notifications')}
              onCheckedChange={(checked) => form.setValue('login_notifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Session Management
          </CardTitle>
          <CardDescription>
            Control how long your sessions remain active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session_timeout_minutes">Session Timeout</Label>
            <Select
              value={form.watch('session_timeout_minutes').toString()}
              onValueChange={(value) => form.setValue('session_timeout_minutes', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select session timeout" />
              </SelectTrigger>
              <SelectContent>
                {getSessionTimeoutOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Your session will automatically expire after this time of inactivity.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sensitive Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Sensitive Actions
          </CardTitle>
          <CardDescription>
            Require additional verification for sensitive account actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require_password_for_sensitive_actions">Password for Sensitive Actions</Label>
              <p className="text-sm text-muted-foreground">
                Require password confirmation for account deletion and other sensitive actions
              </p>
            </div>
            <Switch
              id="require_password_for_sensitive_actions"
              checked={form.watch('require_password_for_sensitive_actions')}
              onCheckedChange={(checked) => form.setValue('require_password_for_sensitive_actions', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Information */}
      {settings?.security_settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.security_settings.last_password_change && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last password change:</span>
                <span className="text-sm">
                  {new Date(settings.security_settings.last_password_change).toLocaleDateString()}
                </span>
              </div>
            )}
            
            {settings.security_settings.failed_login_attempts > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Failed login attempts:</span>
                <span className="text-sm text-red-600">
                  {settings.security_settings.failed_login_attempts}
                </span>
              </div>
            )}

            {settings.security_settings.account_locked_until && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Account locked until:</span>
                <span className="text-sm text-red-600">
                  {new Date(settings.security_settings.account_locked_until).toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Security Settings
        </Button>
      </div>
    </form>
  );
}
