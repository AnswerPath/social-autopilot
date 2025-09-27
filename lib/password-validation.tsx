import { z } from 'zod';

// Password strength levels
export enum PasswordStrength {
  VERY_WEAK = 'very_weak',
  WEAK = 'weak',
  FAIR = 'fair',
  GOOD = 'good',
  STRONG = 'strong'
}

// Password validation result
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
  feedback: string[];
  requirements: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    numbers: boolean;
    symbols: boolean;
    commonPasswords: boolean;
  };
}

// Common weak passwords to check against
const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
  'qwerty123', 'dragon', 'master', 'hello', 'freedom', 'whatever',
  'qazwsx', 'trustno1', 'jordan23', 'harley', 'password1', 'welcome123',
  'login', 'admin123', 'princess', 'qwertyuiop', 'solo', 'passw0rd',
  'starwars', 'sunshine', 'iloveyou', 'asshole', '000000', 'charlie',
  'aa123456', 'donald', 'password123', 'qwerty123', 'welcome', 'monkey',
  '1234567890', 'dragon', 'master', 'hello', 'freedom', 'whatever',
  'qazwsx', 'trustno1', 'jordan23', 'harley', 'password1', 'welcome123'
];

// Password validation configuration
export const PASSWORD_CONFIG = {
  minLength: 8,
  maxLength: 128,
  requireLowercase: true,
  requireUppercase: true,
  requireNumbers: true,
  requireSymbols: true,
  checkCommonPasswords: true,
  maxConsecutiveChars: 3,
  maxRepeatingChars: 2
};

/**
 * Calculate password strength score
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  strength: PasswordStrength;
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];

  // Length scoring
  if (password.length >= 8) {
    score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
  } else {
    feedback.push('Password should be at least 8 characters long');
  }

  // Character variety scoring
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain lowercase letters');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain uppercase letters');
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain numbers');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain special characters');
  }

  // Bonus points for complexity
  if (password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  // Penalty for common patterns
  if (isCommonPassword(password)) {
    score = Math.max(0, score - 2);
    feedback.push('Password is too common, please choose a more unique password');
  }

  // Penalty for consecutive characters
  if (hasConsecutiveChars(password, PASSWORD_CONFIG.maxConsecutiveChars)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid consecutive characters');
  }

  // Penalty for repeating characters
  if (hasRepeatingChars(password, PASSWORD_CONFIG.maxRepeatingChars)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid repeating characters');
  }

  // Determine strength level
  let strength: PasswordStrength;
  if (score < 2) {
    strength = PasswordStrength.VERY_WEAK;
  } else if (score < 3) {
    strength = PasswordStrength.WEAK;
  } else if (score < 4) {
    strength = PasswordStrength.FAIR;
  } else if (score < 5) {
    strength = PasswordStrength.GOOD;
  } else {
    strength = PasswordStrength.STRONG;
  }

  return { score, strength, feedback };
}

/**
 * Check if password is a common password
 */
function isCommonPassword(password: string): boolean {
  const lowerPassword = password.toLowerCase();
  return COMMON_PASSWORDS.some(common => 
    lowerPassword.includes(common) || common.includes(lowerPassword)
  );
}

/**
 * Check for consecutive characters
 */
function hasConsecutiveChars(password: string, maxConsecutive: number): boolean {
  for (let i = 0; i < password.length - maxConsecutive + 1; i++) {
    const sequence = password.slice(i, i + maxConsecutive);
    if (isConsecutiveSequence(sequence)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a sequence is consecutive (e.g., "abc", "123", "zyx")
 */
function isConsecutiveSequence(sequence: string): boolean {
  if (sequence.length < 2) return false;
  
  const chars = sequence.split('');
  const isAscending = chars.every((char, index) => {
    if (index === 0) return true;
    return char.charCodeAt(0) === chars[index - 1].charCodeAt(0) + 1;
  });
  
  const isDescending = chars.every((char, index) => {
    if (index === 0) return true;
    return char.charCodeAt(0) === chars[index - 1].charCodeAt(0) - 1;
  });
  
  return isAscending || isDescending;
}

/**
 * Check for repeating characters
 */
function hasRepeatingChars(password: string, maxRepeating: number): boolean {
  for (let i = 0; i < password.length - maxRepeating; i++) {
    const char = password[i];
    let count = 1;
    for (let j = i + 1; j < password.length; j++) {
      if (password[j] === char) {
        count++;
        if (count > maxRepeating) {
          return true;
        }
      } else {
        break;
      }
    }
  }
  return false;
}

/**
 * Validate password against all requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const { score, strength, feedback } = calculatePasswordStrength(password);
  
  const requirements = {
    length: password.length >= PASSWORD_CONFIG.minLength && password.length <= PASSWORD_CONFIG.maxLength,
    lowercase: PASSWORD_CONFIG.requireLowercase ? /[a-z]/.test(password) : true,
    uppercase: PASSWORD_CONFIG.requireUppercase ? /[A-Z]/.test(password) : true,
    numbers: PASSWORD_CONFIG.requireNumbers ? /[0-9]/.test(password) : true,
    symbols: PASSWORD_CONFIG.requireSymbols ? /[^A-Za-z0-9]/.test(password) : true,
    commonPasswords: PASSWORD_CONFIG.checkCommonPasswords ? !isCommonPassword(password) : true
  };

  const isValid = Object.values(requirements).every(req => req) && 
                  score >= 3 && 
                  !hasConsecutiveChars(password, PASSWORD_CONFIG.maxConsecutiveChars) &&
                  !hasRepeatingChars(password, PASSWORD_CONFIG.maxRepeatingChars);

  return {
    isValid,
    strength,
    score,
    feedback,
    requirements
  };
}

/**
 * Zod schema for password validation
 */
export const PasswordSchema = z.string()
  .min(PASSWORD_CONFIG.minLength, `Password must be at least ${PASSWORD_CONFIG.minLength} characters`)
  .max(PASSWORD_CONFIG.maxLength, `Password must be no more than ${PASSWORD_CONFIG.maxLength} characters`)
  .refine((password) => {
    const validation = validatePassword(password);
    return validation.isValid;
  }, {
    message: "Password does not meet security requirements"
  });

/**
 * Enhanced password change schema with validation
 */
export const PasswordChangeSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: PasswordSchema,
  confirm_password: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
}).refine((data) => data.new_password !== data.current_password, {
  message: "New password must be different from current password",
  path: ["new_password"],
});

/**
 * Password reset request schema
 */
export const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Password reset confirmation schema
 */
export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: PasswordSchema,
  confirm_password: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

/**
 * Get password strength color for UI
 */
export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
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
}

/**
 * Get password strength background color for progress bar
 */
export function getPasswordStrengthBgColor(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VERY_WEAK:
      return 'bg-red-500';
    case PasswordStrength.WEAK:
      return 'bg-orange-500';
    case PasswordStrength.FAIR:
      return 'bg-yellow-500';
    case PasswordStrength.GOOD:
      return 'bg-blue-500';
    case PasswordStrength.STRONG:
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Generate password strength progress bar
 */
export function getPasswordStrengthBar(strength: PasswordStrength): JSX.Element {
  const percentage = (getPasswordStrengthScore(strength) / 5) * 100;
  const color = getPasswordStrengthBgColor(strength);

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
      <div
        className={`h-2 rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Get numeric score for password strength
 */
function getPasswordStrengthScore(strength: PasswordStrength): number {
  switch (strength) {
    case PasswordStrength.VERY_WEAK:
      return 1;
    case PasswordStrength.WEAK:
      return 2;
    case PasswordStrength.FAIR:
      return 3;
    case PasswordStrength.GOOD:
      return 4;
    case PasswordStrength.STRONG:
      return 5;
    default:
      return 0;
  }
}
