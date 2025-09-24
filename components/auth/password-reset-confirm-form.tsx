'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordResetConfirmSchema, validatePassword, PasswordStrength } from '@/lib/password-validation';
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

type PasswordResetConfirmFormData = z.infer<typeof PasswordResetConfirmSchema>;

export function PasswordResetConfirmForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    strength: PasswordStrength.VERY_WEAK,
    score: 0,
    feedback: '',
  });
  const [token, setToken] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<PasswordResetConfirmFormData>({
    resolver: zodResolver(PasswordResetConfirmSchema),
    defaultValues: {
      token: '',
      new_password: '',
      confirm_password: '',
    },
  });

  useEffect(() => {
    // Get token from URL parameters
    const urlToken = searchParams.get('token') || searchParams.get('access_token');
    if (urlToken) {
      setToken(urlToken);
      form.setValue('token', urlToken);
    }
  }, [searchParams, form]);

  const checkPasswordStrength = (password: string) => {
    if (!password) {
      setPasswordStrength({
        strength: PasswordStrength.VERY_WEAK,
        score: 0,
        feedback: '',
      });
      return;
    }

    const validation = validatePassword(password);
    setPasswordStrength({
      strength: validation.strength,
      score: validation.score,
      feedback: validation.feedback.join(', '),
    });
  };

  const onSubmit = async (data: PasswordResetConfirmFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      setIsSuccess(true);
      toast.success('Password reset successfully');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength.strength) {
      case PasswordStrength.VERY_WEAK:
        return 'text-red-600';
      case PasswordStrength.WEAK:
        return 'text-orange-600';
      case PasswordStrength.FAIR:
        return 'text-yellow-600';
      case PasswordStrength.GOOD:
        return 'text-blue-600';
      case PasswordStrength.STRONG:
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
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

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Password Reset Successful</CardTitle>
          <CardDescription>
            Your password has been reset successfully. You can now log in with your new password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You will be redirected to the login page in a few seconds.
            </AlertDescription>
          </Alert>
          <Button 
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>Invalid Reset Link</CardTitle>
          <CardDescription>
            The password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please request a new password reset link from the login page.
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Lock className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>
          Enter your new password below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Hidden token field */}
          <input type="hidden" {...form.register('token')} />

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
                className={`pr-10 ${form.formState.errors.new_password ? 'border-red-500' : ''}`}
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
                className={`pr-10 ${form.formState.errors.confirm_password ? 'border-red-500' : ''}`}
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
                <li>• Avoid common passwords and patterns</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
