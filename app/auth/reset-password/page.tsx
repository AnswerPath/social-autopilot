'use client';

import { PasswordResetForm } from '@/components/auth/password-reset-form';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we will send you a password reset link.
          </p>
        </div>
        <PasswordResetForm />
      </div>
    </div>
  );
}
