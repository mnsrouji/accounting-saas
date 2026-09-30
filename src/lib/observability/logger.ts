// =============================================================
// Observability — Structured Logging, Metrics & Error Tracking
// Phase 15: Billing Integration, Production Infrastructure
// =============================================================
// Design principles:
//   - Zero external dependencies in the base implementation
//   - Pluggable backends: console (dev), structured JSON (prod)
//   - Sentry/Datadog hooks are injected if env vars are present
// =============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  service?: string
  traceId?: string
  userId?: string
  businessId?: string
  data?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    name?: string
  }
}

export interface MetricEvent {
  name: string
  value: number
  unit?: string
  tags?: Record<string, string>
  timestamp?: string
}

// -------------------------------------------------------
// Logger Implementation
// -------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'pwd',
  'secret',
  'clientsecret',
  'client_secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authtoken',
  'auth_token',
  'authorization',
  'apikey',
  'api_key',
  'stripekey',
  'stripe_secret_key',
  'stripe_webhook_secret',
  'signature',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'privatekey',
  'private_key',
])

export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) return data
  if (typeof data !== 'object') return data

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1))
  }

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '')
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('token')) {
      result[key] = '[REDACTED]'
    } else if (typeof val === 'object' && val !== null) {
      result[key] = sanitizeLogData(val, depth + 1)
    } else {
      result[key] = val
    }
  }
  return result
}

class Logger {
  private service: string
  private isProd = process.env.NODE_ENV === 'production'
  private traceId?: string
  private userId?: string
  private businessId?: string

  constructor(
    service = 'accountflow',
    context?: { traceId?: string; userId?: string; businessId?: string }
  ) {
    this.service = service
    this.traceId = context?.traceId
    this.userId = context?.userId
    this.businessId = context?.businessId
  }

  private format(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
    const sanitized = data ? (sanitizeLogData(data) as Record<string, unknown>) : undefined
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      traceId: this.traceId,
      userId: this.userId,
      businessId: this.businessId,
      ...sanitized,
    }
  }

  private output(entry: LogEntry) {
    if (this.isProd) {
      // Structured JSON for log aggregators (Datadog, CloudWatch, etc.)
      console.log(JSON.stringify(entry))
    } else {
      const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp} [${entry.service}]`
      const errorPart = entry.error ? ` ERROR: ${entry.error.message}` : ''
      const dataPart = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
      console[entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log'](
        `${prefix} ${entry.message}${errorPart}${dataPart}`
      )
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    if (!this.isProd) {
      this.output(this.format('debug', message, data))
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    this.output(this.format('info', message, data))
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.output(this.format('warn', message, data))
  }

  error(message: string, error?: unknown, data?: Record<string, unknown>) {
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : error
        ? { message: String(error) }
        : undefined

    this.output(this.format('error', message, {
      ...data,
      error: errorInfo as LogEntry['error'],
    }))

    // Hook: Sentry integration (no-op if not configured)
    if (process.env.SENTRY_DSN && error instanceof Error) {
      this.captureToSentry(error, data)
    }
  }

  child(context: { service?: string; traceId?: string; userId?: string; businessId?: string }): Logger {
    return new Logger(context.service || this.service, {
      traceId: context.traceId || this.traceId,
      userId: context.userId || this.userId,
      businessId: context.businessId || this.businessId,
    })
  }

  private captureToSentry(error: Error, context?: Record<string, unknown>) {
    try {
      // Safe dynamic require to avoid bundling Sentry when not installed
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const dynamicRequire = eval('require')
      const Sentry = dynamicRequire('@sentry/node')
      Sentry.withScope((scope: { setContext: (k: string, v: unknown) => void }) => {
        if (context) scope.setContext('extra', context)
        Sentry.captureException(error)
      })
    } catch {
      // Sentry not installed — silently ignore
    }
  }
}

// -------------------------------------------------------
// Metrics Collection
// -------------------------------------------------------

class Metrics {
  private buffer: MetricEvent[] = []
  private isProd = process.env.NODE_ENV === 'production'

  record(event: MetricEvent) {
    const enriched: MetricEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    }

    this.buffer.push(enriched)

    if (this.isProd) {
      // Emit as structured log for metric scraping
      console.log(JSON.stringify({ type: 'metric', ...enriched }))
    } else {
      console.log(`[METRIC] ${enriched.name}=${enriched.value}${enriched.unit ? enriched.unit : ''} ${JSON.stringify(enriched.tags || {})}`)
    }

    // Keep buffer bounded
    if (this.buffer.length > 1000) {
      this.buffer = this.buffer.slice(-500)
    }
  }

  increment(name: string, tags?: Record<string, string>) {
    this.record({ name, value: 1, tags })
  }

  gauge(name: string, value: number, tags?: Record<string, string>) {
    this.record({ name, value, unit: 'gauge', tags })
  }

  histogram(name: string, value: number, unit = 'ms', tags?: Record<string, string>) {
    this.record({ name, value, unit, tags })
  }

  getBuffer(): MetricEvent[] {
    return [...this.buffer]
  }
}

// -------------------------------------------------------
// Performance Timer
// -------------------------------------------------------

export function createTimer(name: string, tags?: Record<string, string>) {
  const start = Date.now()
  return {
    end: () => {
      const durationMs = Date.now() - start
      metrics.histogram(name, durationMs, 'ms', tags)
      return durationMs
    },
  }
}

// -------------------------------------------------------
// Singletons
// -------------------------------------------------------

export const logger = new Logger('accountflow')
export const metrics = new Metrics()

// -------------------------------------------------------
// Request Context (for tracing)
// -------------------------------------------------------

export function withRequestContext(
  requestId: string,
  fn: (log: Logger) => Promise<Response>
): Promise<Response> {
  const contextLogger = logger.child({ service: `req:${requestId.slice(0, 8)}` })
  return fn(contextLogger)
}
