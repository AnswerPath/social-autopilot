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
import { PasswordResetRequestSchema } from '@/lib/password-validation';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type PasswordResetFormData = z.infer<typeof PasswordResetRequestSchema>;

export function PasswordResetForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<PasswordResetFormData>({
    resolver: zodResolver(PasswordResetRequestSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: PasswordResetFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reset email');
      }

      setIsSuccess(true);
      toast.success('Password reset email sent successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Check Your Email</CardTitle>
          <CardDescription>
            We've sent a password reset link to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              If you don't see the email in your inbox, check your spam folder. 
              The reset link will expire in 1 hour.
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setIsSuccess(false);
              form.reset();
            }}
          >
            Send Another Email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Mail className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>Reset Your Password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              {...form.register('email')}
              className={form.formState.errors.email ? 'border-red-500' : ''}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-600">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Remember your password?{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
