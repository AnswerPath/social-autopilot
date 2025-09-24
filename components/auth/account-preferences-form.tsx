'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountSettings } from '@/hooks/use-account-settings';
import { AccountPreferences } from '@/lib/auth-types';
import { Loader2, Globe, Clock, Palette, Eye, Save } from 'lucide-react';
import { toast } from 'sonner';

const AccountPreferencesSchema = z.object({
  language: z.string().min(2).max(10),
  timezone: z.string(),
  date_format: z.string(),
  time_format: z.enum(['12h', '24h']),
  theme: z.enum(['light', 'dark', 'system']),
  compact_mode: z.boolean(),
  auto_save_drafts: z.boolean(),
  default_post_visibility: z.enum(['public', 'private', 'team']),
});

type AccountPreferencesFormData = z.infer<typeof AccountPreferencesSchema>;

export function AccountPreferencesForm() {
  const { settings, updateAccountPreferences, loading } = useAccountSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AccountPreferencesFormData>({
    resolver: zodResolver(AccountPreferencesSchema),
    defaultValues: {
      language: 'en',
      timezone: 'UTC',
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      theme: 'system',
      compact_mode: false,
      auto_save_drafts: true,
      default_post_visibility: 'public',
    },
  });

  useEffect(() => {
    if (settings?.account_preferences) {
      form.reset(settings.account_preferences);
    }
  }, [settings, form]);

  const onSubmit = async (data: AccountPreferencesFormData) => {
    setIsSubmitting(true);
    try {
      await updateAccountPreferences(data);
      toast.success('Account preferences updated successfully');
    } catch (error) {
      toast.error('Failed to update account preferences');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLanguageOptions = () => {
    return [
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Español' },
      { value: 'fr', label: 'Français' },
      { value: 'de', label: 'Deutsch' },
      { value: 'it', label: 'Italiano' },
      { value: 'pt', label: 'Português' },
      { value: 'ru', label: 'Русский' },
      { value: 'ja', label: '日本語' },
      { value: 'ko', label: '한국어' },
      { value: 'zh', label: '中文' },
    ];
  };

  const getTimezoneOptions = () => {
    return [
      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'Europe/London', label: 'London (GMT)' },
      { value: 'Europe/Paris', label: 'Paris (CET)' },
      { value: 'Europe/Berlin', label: 'Berlin (CET)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
      { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
    ];
  };

  const getDateFormatOptions = () => {
    return [
      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (EU)' },
      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
      { value: 'MM-DD-YY', label: 'MM-DD-YY (Short)' },
    ];
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
      {/* Language & Region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Language & Region
          </CardTitle>
          <CardDescription>
            Set your preferred language and regional settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={form.watch('language')}
              onValueChange={(value) => form.setValue('language', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {getLanguageOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={form.watch('timezone')}
              onValueChange={(value) => form.setValue('timezone', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {getTimezoneOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_format">Date Format</Label>
            <Select
              value={form.watch('date_format')}
              onValueChange={(value) => form.setValue('date_format', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select date format" />
              </SelectTrigger>
              <SelectContent>
                {getDateFormatOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time_format">Time Format</Label>
            <Select
              value={form.watch('time_format')}
              onValueChange={(value) => form.setValue('time_format', value as '12h' | '24h')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select time format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Display Settings
          </CardTitle>
          <CardDescription>
            Customize how the application looks and behaves.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={form.watch('theme')}
              onValueChange={(value) => form.setValue('theme', value as 'light' | 'dark' | 'system')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose your preferred color scheme
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="compact_mode">Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Use a more compact layout with less spacing
              </p>
            </div>
            <Switch
              id="compact_mode"
              checked={form.watch('compact_mode')}
              onCheckedChange={(checked) => form.setValue('compact_mode', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Content Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Content Settings
          </CardTitle>
          <CardDescription>
            Configure how content is handled and saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_save_drafts">Auto-save Drafts</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save post drafts as you write
              </p>
            </div>
            <Switch
              id="auto_save_drafts"
              checked={form.watch('auto_save_drafts')}
              onCheckedChange={(checked) => form.setValue('auto_save_drafts', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_post_visibility">Default Post Visibility</Label>
            <Select
              value={form.watch('default_post_visibility')}
              onValueChange={(value) => form.setValue('default_post_visibility', value as 'public' | 'private' | 'team')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Default visibility for new posts
            </p>
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
