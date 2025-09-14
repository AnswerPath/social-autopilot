import { NextRequest } from 'next/server';

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  // Login attempts
  loginAttempts: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  // Password reset requests
  passwordReset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  // Token refresh requests
  tokenRefresh: {
    maxAttempts: 20,
    windowMs: 5 * 60 * 1000, // 5 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
  },
  // General API requests
  general: {
    maxAttempts: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
  }
};

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, {
  attempts: number;
  firstAttempt: number;
  blockedUntil?: number;
}>();

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Use IP address as primary identifier
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Add user agent hash for additional uniqueness
  const userAgent = request.headers.get('user-agent') || '';
  const userAgentHash = userAgent.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return `${ip}-${userAgentHash}`;
}

/**
 * Check if client is rate limited
 */
export function isRateLimited(
  request: NextRequest, 
  type: keyof typeof RATE_LIMIT_CONFIG = 'general'
): { isLimited: boolean; remainingAttempts: number; resetTime?: number } {
  const clientId = getClientIdentifier(request);
  const config = RATE_LIMIT_CONFIG[type];
  const now = Date.now();
  
  const clientData = rateLimitStore.get(clientId);
  
  // If no previous attempts, allow
  if (!clientData) {
    return { isLimited: false, remainingAttempts: config.maxAttempts };
  }
  
  // Check if currently blocked
  if (clientData.blockedUntil && now < clientData.blockedUntil) {
    return { 
      isLimited: true, 
      remainingAttempts: 0, 
      resetTime: clientData.blockedUntil 
    };
  }
  
  // Check if window has expired
  if (now - clientData.firstAttempt > config.windowMs) {
    // Reset the window
    rateLimitStore.delete(clientId);
    return { isLimited: false, remainingAttempts: config.maxAttempts };
  }
  
  // Check if max attempts reached
  if (clientData.attempts >= config.maxAttempts) {
    // Block the client
    clientData.blockedUntil = now + config.blockDurationMs;
    rateLimitStore.set(clientId, clientData);
    
    return { 
      isLimited: true, 
      remainingAttempts: 0, 
      resetTime: clientData.blockedUntil 
    };
  }
  
  return { 
    isLimited: false, 
    remainingAttempts: config.maxAttempts - clientData.attempts 
  };
}

/**
 * Record an attempt
 */
export function recordAttempt(
  request: NextRequest, 
  type: keyof typeof RATE_LIMIT_CONFIG = 'general'
): void {
  const clientId = getClientIdentifier(request);
  const config = RATE_LIMIT_CONFIG[type];
  const now = Date.now();
  
  const clientData = rateLimitStore.get(clientId);
  
  if (!clientData) {
    // First attempt
    rateLimitStore.set(clientId, {
      attempts: 1,
      firstAttempt: now
    });
  } else {
    // Check if window has expired
    if (now - clientData.firstAttempt > config.windowMs) {
      // Reset the window
      rateLimitStore.set(clientId, {
        attempts: 1,
        firstAttempt: now
      });
    } else {
      // Increment attempts
      clientData.attempts++;
      rateLimitStore.set(clientId, clientData);
    }
  }
}

/**
 * Clear rate limit for a client (useful for successful authentication)
 */
export function clearRateLimit(
  request: NextRequest, 
  type: keyof typeof RATE_LIMIT_CONFIG = 'general'
): void {
  const clientId = getClientIdentifier(request);
  rateLimitStore.delete(clientId);
}

/**
 * Get rate limit status for a client
 */
export function getRateLimitStatus(
  request: NextRequest, 
  type: keyof typeof RATE_LIMIT_CONFIG = 'general'
): {
  attempts: number;
  remainingAttempts: number;
  resetTime?: number;
  isBlocked: boolean;
} {
  const clientId = getClientIdentifier(request);
  const config = RATE_LIMIT_CONFIG[type];
  const now = Date.now();
  
  const clientData = rateLimitStore.get(clientId);
  
  if (!clientData) {
    return {
      attempts: 0,
      remainingAttempts: config.maxAttempts,
      isBlocked: false
    };
  }
  
  // Check if window has expired
  if (now - clientData.firstAttempt > config.windowMs) {
    return {
      attempts: 0,
      remainingAttempts: config.maxAttempts,
      isBlocked: false
    };
  }
  
  const isBlocked = clientData.blockedUntil ? now < clientData.blockedUntil : false;
  const remainingAttempts = Math.max(0, config.maxAttempts - clientData.attempts);
  
  return {
    attempts: clientData.attempts,
    remainingAttempts,
    resetTime: clientData.blockedUntil,
    isBlocked
  };
}

/**
 * Clean up expired entries (call this periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  
  for (const [clientId, data] of rateLimitStore.entries()) {
    const maxWindow = Math.max(
      RATE_LIMIT_CONFIG.loginAttempts.windowMs,
      RATE_LIMIT_CONFIG.passwordReset.windowMs,
      RATE_LIMIT_CONFIG.general.windowMs
    );
    
    // Remove entries that are older than the maximum window
    if (now - data.firstAttempt > maxWindow) {
      rateLimitStore.delete(clientId);
    }
  }
}

/**
 * Rate limiting middleware for API routes
 */
export function withRateLimit(
  type: keyof typeof RATE_LIMIT_CONFIG = 'general'
) {
  return function rateLimitMiddleware(
    request: NextRequest,
    handler: (request: NextRequest) => Promise<Response>
  ): Promise<Response> {
    const rateLimitCheck = isRateLimited(request, type);
    
    if (rateLimitCheck.isLimited) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'Too many requests',
            message: `Rate limit exceeded. Please try again in ${Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000 / 60)} minutes.`,
            retryAfter: Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000)
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': RATE_LIMIT_CONFIG[type].maxAttempts.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitCheck.resetTime!.toString()
            }
          }
        )
      );
    }
    
    // Record the attempt
    recordAttempt(request, type);
    
    // Add rate limit headers to response
    const response = handler(request);
    
    return response.then(res => {
      const newResponse = res.clone();
      newResponse.headers.set('X-RateLimit-Limit', RATE_LIMIT_CONFIG[type].maxAttempts.toString());
      newResponse.headers.set('X-RateLimit-Remaining', rateLimitCheck.remainingAttempts.toString());
      
      return newResponse;
    });
  };
}

// Clean up expired entries every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
