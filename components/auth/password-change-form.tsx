'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAccountSettings } from '@/hooks/use-account-settings';
import { PasswordChangeRequest } from '@/lib/auth-types';
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const PasswordChangeSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
}).refine((data) => data.new_password !== data.current_password, {
  message: "New password must be different from current password",
  path: ["new_password"],
});

type PasswordChangeFormData = z.infer<typeof PasswordChangeSchema>;

export function PasswordChangeForm() {
  const { changePassword } = useAccountSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: '',
  });

  const form = useForm<PasswordChangeFormData>({
    resolver: zodResolver(PasswordChangeSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const checkPasswordStrength = (password: string) => {
    let score = 0;
    const feedback = [];

    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score < 2) feedback.push('Very weak');
    else if (score < 3) feedback.push('Weak');
    else if (score < 4) feedback.push('Fair');
    else if (score < 5) feedback.push('Good');
    else feedback.push('Strong');

    setPasswordStrength({ score, feedback: feedback.join(', ') });
  };

  const onSubmit = async (data: PasswordChangeFormData) => {
    setIsSubmitting(true);
    try {
      await changePassword(data);
      toast.success('Password changed successfully');
      form.reset();
      setPasswordStrength({ score: 0, feedback: '' });
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score < 2) return 'text-red-600';
    if (passwordStrength.score < 3) return 'text-orange-600';
    if (passwordStrength.score < 4) return 'text-yellow-600';
    if (passwordStrength.score < 5) return 'text-blue-600';
    return 'text-green-600';
  };

  const getPasswordStrengthBar = () => {
    const percentage = (passwordStrength.score / 5) * 100;
    let color = 'bg-red-500';
    if (passwordStrength.score >= 3) color = 'bg-yellow-500';
    if (passwordStrength.score >= 4) color = 'bg-blue-500';
    if (passwordStrength.score >= 5) color = 'bg-green-500';

    return (
      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password securely. Make sure to use a strong password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current_password">Current Password</Label>
            <div className="relative">
              <Input
                id="current_password"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Enter your current password"
                {...form.register('current_password')}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.current_password && (
              <p className="text-sm text-red-600">
                {form.formState.errors.current_password.message}
              </p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new_password">New Password</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter your new password"
                {...form.register('new_password', {
                  onChange: (e) => checkPasswordStrength(e.target.value),
                })}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.watch('new_password') && (
              <div className="space-y-2">
                {getPasswordStrengthBar()}
                <div className="flex items-center justify-between text-sm">
                  <span className={getPasswordStrengthColor()}>
                    {passwordStrength.feedback}
                  </span>
                  <span className="text-muted-foreground">
                    {passwordStrength.score}/5
                  </span>
                </div>
              </div>
            )}
            {form.formState.errors.new_password && (
              <p className="text-sm text-red-600">
                {form.formState.errors.new_password.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your new password"
                {...form.register('confirm_password')}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.confirm_password && (
              <p className="text-sm text-red-600">
                {form.formState.errors.confirm_password.message}
              </p>
            )}
          </div>

          {/* Password Requirements */}
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Password Requirements:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• At least 8 characters long</li>
                <li>• Include uppercase and lowercase letters</li>
                <li>• Include numbers and special characters</li>
                <li>• Different from your current password</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Change Password
        </Button>
      </div>
    </form>
  );
}
