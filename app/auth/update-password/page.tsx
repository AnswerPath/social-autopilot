'use client';

import { PasswordResetConfirmForm } from '@/components/auth/password-reset-confirm-form';
import { Suspense } from 'react';

export default function UpdatePasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Set New Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below.
          </p>
        </div>
        <Suspense fallback={<div className="text-sm text-gray-600">Loading…</div>}>
          <PasswordResetConfirmForm />
        </Suspense>
      </div>
    </div>
  );
}
