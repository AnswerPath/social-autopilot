'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAccountSettings } from '@/hooks/use-account-settings';
import { NotificationPreferences } from '@/lib/auth-types';
import { Loader2, Bell, Mail, Smartphone, AlertTriangle, BarChart3, Shield, Megaphone, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

const NotificationPreferencesSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  mention_notifications: z.boolean(),
  post_approval_notifications: z.boolean(),
  analytics_notifications: z.boolean(),
  security_notifications: z.boolean(),
  marketing_emails: z.boolean(),
  weekly_digest: z.boolean(),
  daily_summary: z.boolean(),
});

type NotificationPreferencesFormData = z.infer<typeof NotificationPreferencesSchema>;

export function NotificationPreferencesForm() {
  const { settings, updateNotificationPreferences, loading } = useAccountSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NotificationPreferencesFormData>({
    resolver: zodResolver(NotificationPreferencesSchema),
    defaultValues: {
      email_notifications: true,
      push_notifications: true,
      mention_notifications: true,
      post_approval_notifications: true,
      analytics_notifications: true,
      security_notifications: true,
      marketing_emails: false,
      weekly_digest: true,
      daily_summary: false,
    },
  });

  useEffect(() => {
    if (settings?.notification_preferences) {
      form.reset(settings.notification_preferences);
    }
  }, [settings, form]);

  const onSubmit = async (data: NotificationPreferencesFormData) => {
    setIsSubmitting(true);
    try {
      await updateNotificationPreferences(data);
      toast.success('Notification preferences updated successfully');
    } catch (error) {
      toast.error('Failed to update notification preferences');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading preferences...</span>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Control which notifications you receive via email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email_notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="email_notifications"
              checked={form.watch('email_notifications')}
              onCheckedChange={(checked) => form.setValue('email_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mention_notifications">Mention Notifications</Label>
              <p className="text-sm text-muted-foreground">
                When someone mentions you in a post
              </p>
            </div>
            <Switch
              id="mention_notifications"
              checked={form.watch('mention_notifications')}
              onCheckedChange={(checked) => form.setValue('mention_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="post_approval_notifications">Post Approval Notifications</Label>
              <p className="text-sm text-muted-foreground">
                When posts require your approval
              </p>
            </div>
            <Switch
              id="post_approval_notifications"
              checked={form.watch('post_approval_notifications')}
              onCheckedChange={(checked) => form.setValue('post_approval_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics_notifications">Analytics Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Important analytics updates and insights
              </p>
            </div>
            <Switch
              id="analytics_notifications"
              checked={form.watch('analytics_notifications')}
              onCheckedChange={(checked) => form.setValue('analytics_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="security_notifications">Security Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Account security alerts and updates
              </p>
            </div>
            <Switch
              id="security_notifications"
              checked={form.watch('security_notifications')}
              onCheckedChange={(checked) => form.setValue('security_notifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive instant notifications on your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push_notifications">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive real-time notifications on your device
              </p>
            </div>
            <Switch
              id="push_notifications"
              checked={form.watch('push_notifications')}
              onCheckedChange={(checked) => form.setValue('push_notifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Marketing & Digest */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Marketing & Digest
          </CardTitle>
          <CardDescription>
            Control marketing communications and digest emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing_emails">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Receive promotional and marketing content
              </p>
            </div>
            <Switch
              id="marketing_emails"
              checked={form.watch('marketing_emails')}
              onCheckedChange={(checked) => form.setValue('marketing_emails', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="weekly_digest">Weekly Digest</Label>
              <p className="text-sm text-muted-foreground">
                Weekly summary of your account activity
              </p>
            </div>
            <Switch
              id="weekly_digest"
              checked={form.watch('weekly_digest')}
              onCheckedChange={(checked) => form.setValue('weekly_digest', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="daily_summary">Daily Summary</Label>
              <p className="text-sm text-muted-foreground">
                Daily summary of your account activity
              </p>
            </div>
            <Switch
              id="daily_summary"
              checked={form.watch('daily_summary')}
              onCheckedChange={(checked) => form.setValue('daily_summary', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </form>
  );
}
