'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Lock, Eye, EyeOff, User, CheckCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

// Validation schema for registration form
const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  display_name: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false
  })
  const { register: registerUser, loading } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  })

  const password = watch('password', '')

  // Check password strength
  React.useEffect(() => {
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password)
    })
  }, [password])

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data)
      toast.success('Registration successful! Welcome to the platform.')
      onSuccess?.()
      // Redirect to home so onboarding check runs; user is then sent to /onboarding or /dashboard
      router.push('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create account</CardTitle>
        <CardDescription className="text-center">
          Enter your information to create a new account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="first_name"
                  placeholder="John"
                  className="pl-10"
                  {...register('first_name')}
                />
              </div>
              {errors.first_name && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription>{errors.first_name.message}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                placeholder="Doe"
                {...register('last_name')}
              />
              {errors.last_name && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription>{errors.last_name.message}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name (Optional)</Label>
            <Input
              id="display_name"
              placeholder="How you'll appear to others"
              {...register('display_name')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{errors.email.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                className="pl-10 pr-10"
                {...register('password')}
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
            
            {/* Password strength indicator */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className={`h-4 w-4 ${passwordStrength.length ? 'text-green-500' : 'text-gray-300'}`} />
                <span className={passwordStrength.length ? 'text-green-600' : 'text-gray-500'}>
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className={`h-4 w-4 ${passwordStrength.uppercase ? 'text-green-500' : 'text-gray-300'}`} />
                <span className={passwordStrength.uppercase ? 'text-green-600' : 'text-gray-500'}>
                  One uppercase letter
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className={`h-4 w-4 ${passwordStrength.lowercase ? 'text-green-500' : 'text-gray-300'}`} />
                <span className={passwordStrength.lowercase ? 'text-green-600' : 'text-gray-500'}>
                  One lowercase letter
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className={`h-4 w-4 ${passwordStrength.number ? 'text-green-500' : 'text-gray-300'}`} />
                <span className={passwordStrength.number ? 'text-green-600' : 'text-gray-500'}>
                  One number
                </span>
              </div>
            </div>

            {errors.password && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{errors.password.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                className="pl-10 pr-10"
                {...register('confirmPassword')}
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
            {errors.confirmPassword && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{errors.confirmPassword.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto font-semibold"
              onClick={onSwitchToLogin}
            >
              Sign in
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
