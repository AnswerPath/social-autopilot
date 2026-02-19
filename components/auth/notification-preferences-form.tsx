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
import { Separator } from '@/components/ui/separator';
import { useAccountSettings } from '@/hooks/use-account-settings';
import { Loader2, Mail, Smartphone, Megaphone } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const NotificationPreferencesSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  sms_notifications: z.boolean().optional(),
  phone_number: z.string().optional().nullable(),
  mention_notifications: z.boolean(),
  post_approval_notifications: z.boolean(),
  analytics_notifications: z.boolean(),
  security_notifications: z.boolean(),
  marketing_emails: z.boolean(),
  weekly_digest: z.boolean(),
  daily_summary: z.boolean(),
  digest_frequency: z.enum(['immediate', 'daily', 'weekly']).optional(),
}).refine(
  (data) => !data.sms_notifications || (data.phone_number && data.phone_number.trim().length > 0),
  { message: 'Please enter a phone number to receive SMS notifications.', path: ['phone_number'] }
);

type NotificationPreferencesFormData = z.infer<typeof NotificationPreferencesSchema>;

export function NotificationPreferencesForm() {
  const { settings, updateNotificationPreferences, loading } = useAccountSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NotificationPreferencesFormData>({
    resolver: zodResolver(NotificationPreferencesSchema),
    defaultValues: {
      email_notifications: true,
      push_notifications: true,
      sms_notifications: false,
      phone_number: '',
      mention_notifications: true,
      post_approval_notifications: true,
      analytics_notifications: true,
      security_notifications: true,
      marketing_emails: false,
      weekly_digest: true,
      daily_summary: false,
      digest_frequency: 'immediate',
    },
  });

  useEffect(() => {
    if (settings?.notification_preferences) {
      const prefs = settings.notification_preferences as NotificationPreferencesFormData;
      form.reset({
        ...prefs,
        sms_notifications: prefs.sms_notifications ?? false,
        phone_number: prefs.phone_number ?? '',
        digest_frequency: prefs.digest_frequency ?? 'immediate',
      });
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

      {/* Push & SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Channels
          </CardTitle>
          <CardDescription>
            Choose how you receive notifications: in-app, push, and SMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push_notifications">Push (in-app) Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Real-time notifications in the app
              </p>
            </div>
            <Switch
              id="push_notifications"
              checked={form.watch('push_notifications')}
              onCheckedChange={(checked) => form.setValue('push_notifications', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms_notifications">SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive urgent alerts via text message
              </p>
            </div>
            <Switch
              id="sms_notifications"
              checked={form.watch('sms_notifications') ?? false}
              onCheckedChange={(checked) => {
                form.setValue('sms_notifications', checked);
                if (checked && !form.getValues('phone_number')?.trim()) {
                  toast.info('Add your phone number below to receive SMS notifications.');
                }
              }}
            />
          </div>
          {form.watch('sms_notifications') && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="phone_number">Phone number</Label>
              <p className="text-sm text-muted-foreground">
                Required for SMS. Use E.164 format (e.g. +1234567890).
              </p>
              <Input
                id="phone_number"
                type="tel"
                placeholder="+1 234 567 8900"
                {...form.register('phone_number')}
                className={form.formState.errors.phone_number ? 'border-destructive' : ''}
              />
              {form.formState.errors.phone_number && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.phone_number.message}
                </p>
              )}
            </div>
          )}
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

          <div className="space-y-2">
            <Label htmlFor="digest_frequency">Digest frequency</Label>
            <p className="text-sm text-muted-foreground">
              When to receive non-urgent notifications
            </p>
            <Select
              value={form.watch('digest_frequency') ?? 'immediate'}
              onValueChange={(value: 'immediate' | 'daily' | 'weekly') => form.setValue('digest_frequency', value)}
            >
              <SelectTrigger id="digest_frequency">
                <SelectValue placeholder="Immediate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
              </SelectContent>
            </Select>
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
