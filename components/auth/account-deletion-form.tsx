'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAccountSettings } from '@/hooks/use-account-settings';
import { AccountDeletionRequest } from '@/lib/auth-types';
import { Loader2, Trash2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AccountDeletionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

type AccountDeletionFormData = z.infer<typeof AccountDeletionSchema>;

export function AccountDeletionForm() {
  const { deleteAccount } = useAccountSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  const form = useForm<AccountDeletionFormData>({
    resolver: zodResolver(AccountDeletionSchema),
    defaultValues: {
      password: '',
      reason: '',
      feedback: '',
    },
  });

  const onSubmit = async (data: AccountDeletionFormData) => {
    if (confirmationText !== 'DELETE') {
      toast.error('Please type DELETE to confirm account deletion');
      return;
    }

    if (!confirm('This action is irreversible. Are you absolutely sure you want to delete your account? All your data will be permanently lost.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteAccount(data);
      toast.success('Account deleted successfully');
      // Redirect to home page or login page
      window.location.href = '/';
    } catch (error) {
      toast.error('Failed to delete account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800 dark:text-red-200">
          <strong>Warning:</strong> This action is irreversible. Once you delete your account, 
          all your data, posts, and settings will be permanently removed and cannot be recovered.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Password Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password to confirm"
                {...form.register('password')}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter your current password to confirm this action.
            </p>
            {form.formState.errors.password && (
              <p className="text-sm text-red-600">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Reason for Deletion */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Deletion (Optional)</Label>
            <Select
              value={form.watch('reason') || ''}
              onValueChange={(value) => form.setValue('reason', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_longer_needed">No longer needed</SelectItem>
                <SelectItem value="privacy_concerns">Privacy concerns</SelectItem>
                <SelectItem value="switching_platforms">Switching to another platform</SelectItem>
                <SelectItem value="unsatisfactory_service">Unsatisfactory service</SelectItem>
                <SelectItem value="technical_issues">Technical issues</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Additional Feedback (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Tell us how we could have improved your experience..."
              {...form.register('feedback')}
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              Your feedback helps us improve our service for other users.
            </p>
          </div>

          {/* Final Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
            </Label>
            <Input
              id="confirmation"
              type="text"
              placeholder="DELETE"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              className="font-mono"
            />
            <p className="text-sm text-muted-foreground">
              This is your final confirmation step.
            </p>
          </div>

          {/* What Will Be Deleted */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <h4 className="font-medium mb-2">What will be deleted:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Your account and profile information</li>
              <li>• All your posts and content</li>
              <li>• Your account settings and preferences</li>
              <li>• All associated data and analytics</li>
              <li>• Your session history and login records</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          type="submit" 
          variant="destructive"
          disabled={isSubmitting || confirmationText !== 'DELETE'}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Trash2 className="mr-2 h-4 w-4" />
          Permanently Delete Account
        </Button>
      </div>
    </form>
  );
}
