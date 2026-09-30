// =============================================================
// Enhanced Health Monitoring API — Phase 15 Upgrade
// GET /api/health — System Status, Readiness & Liveness
// GET /api/health/ready — Kubernetes readiness probe
// GET /api/health/live  — Kubernetes liveness probe
// =============================================================

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getBillingProvider } from '@/lib/billing/billing-registry'
import { metrics } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

const START_TIME = Date.now()

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'error'
  latencyMs: number
  detail?: string
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start
    return { status: 'healthy', latencyMs }
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      detail: (err as Error).message,
    }
  }
}

function checkBillingProvider(): HealthCheckResult {
  const start = Date.now()
  try {
    const provider = getBillingProvider()
    const configured = provider.isConfigured()
    return {
      status: configured ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      detail: `provider=${provider.providerId}`,
    }
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      detail: (err as Error).message,
    }
  }
}

export async function GET() {
  const requestStart = Date.now()
  const mem = process.memoryUsage()

  const [dbCheck, billingCheck] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkBillingProvider()),
  ])

  const overallStatus =
    dbCheck.status === 'error'
      ? 'error'
      : dbCheck.status === 'degraded' || billingCheck.status === 'degraded'
        ? 'degraded'
        : 'healthy'

  const uptimeMs = Date.now() - START_TIME
  const responseTimeMs = Date.now() - requestStart

  // Emit metrics
  metrics.gauge('health.db.latency', dbCheck.latencyMs, { component: 'database' })
  metrics.gauge('health.memory.heap_mb', Math.round(mem.heapUsed / 1024 / 1024))
  metrics.gauge('health.uptime_s', Math.floor(uptimeMs / 1000))

  const body = {
    status: overallStatus,
    version: '1.15.0',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptimeMs / 1000),
      human: formatUptime(uptimeMs),
    },
    checks: {
      database: {
        status: dbCheck.status,
        latencyMs: dbCheck.latencyMs,
        detail: dbCheck.detail,
      },
      billing: {
        status: billingCheck.status,
        latencyMs: billingCheck.latencyMs,
        detail: billingCheck.detail,
      },
    },
    system: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'production',
      memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      memoryHeapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    },
    performance: {
      responseTimeMs,
    },
  }

  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503

  return NextResponse.json(body, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${days}d ${hours}h ${mins}m ${secs}s`
}
