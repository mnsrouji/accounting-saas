// =============================================================
// Security Middleware — Rate Limiting, CORS & Request Hardening
// Phase 15: Production Hardening & Security
// =============================================================

import { NextRequest, NextResponse } from 'next/server'

// -------------------------------------------------------
// Simple in-memory rate limiter (edge-compatible)
// For production scale: replace with Redis/Upstash
// -------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  identifier?: (req: NextRequest) => string
}

export function createRateLimiter(config: RateLimitConfig) {
  return function rateLimit(req: NextRequest): {
    allowed: boolean
    remaining: number
    resetAt: number
    response?: NextResponse
  } {
    const id = config.identifier
      ? config.identifier(req)
      : req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        '127.0.0.1'

    const key = `rl:${id}`
    const now = Date.now()

    let entry = rateLimitStore.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs }
      rateLimitStore.set(key, entry)
    }

    entry.count++
    const remaining = Math.max(0, config.maxRequests - entry.count)
    const allowed = entry.count <= config.maxRequests

    // Cleanup old entries periodically
    if (rateLimitStore.size > 10000) {
      const cutoff = Date.now()
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetAt < cutoff) rateLimitStore.delete(k)
      }
    }

    if (!allowed) {
      const response = NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      )
      return { allowed: false, remaining: 0, resetAt: entry.resetAt, response }
    }

    return { allowed: true, remaining, resetAt: entry.resetAt }
  }
}

// -------------------------------------------------------
// Pre-configured rate limiters
// -------------------------------------------------------

/** Webhook endpoint: 500/min (high volume from providers) */
export const webhookRateLimiter = createRateLimiter({
  maxRequests: 500,
  windowMs: 60_000,
})

/** API routes: 100/min per IP */
export const apiRateLimiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 60_000,
})

/** Auth endpoints: 10/min per IP (brute-force protection) */
export const authRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
})

// -------------------------------------------------------
// Security Headers
// -------------------------------------------------------

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
} as const

export function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

// -------------------------------------------------------
// Input sanitization helpers
// -------------------------------------------------------

/** Strip potential XSS characters from user input strings */
export function sanitizeString(input: string, maxLength = 500): string {
  return input
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[<>"'`]/g, '') // strip dangerous chars
    .trim()
    .slice(0, maxLength)
}

/** Validate that a string is a valid UUID v4 */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
