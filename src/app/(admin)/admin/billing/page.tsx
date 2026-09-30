// =============================================================
// Admin Billing Events — Webhook Event Monitor
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// /admin/billing
// =============================================================

import { requirePlatformAdmin } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import type { BillingWebhookEvent } from '@prisma/client'
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw, Webhook } from 'lucide-react'

export const metadata = {
  title: 'Billing Events | Admin',
  description: 'Monitor billing webhook events across all tenants',
}

export const dynamic = 'force-dynamic'

async function getBillingEvents(): Promise<BillingWebhookEvent[]> {
  return prisma.billingWebhookEvent.findMany({
    orderBy: { receivedAt: 'desc' },
    take: 100,
  })
}

async function getBillingStats() {
  const [total, processed, failed, pending] = await Promise.all([
    prisma.billingWebhookEvent.count(),
    prisma.billingWebhookEvent.count({ where: { status: 'processed' } }),
    prisma.billingWebhookEvent.count({ where: { status: 'failed' } }),
    prisma.billingWebhookEvent.count({ where: { status: { in: ['pending', 'processing'] } } }),
  ])
  return { total, processed, failed, pending }
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; className: string }> = {
    processed: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    failed: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      className: 'text-red-700 bg-red-50 border-red-200',
    },
    processing: {
      icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
      className: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    pending: {
      icon: <Clock className="h-3.5 w-3.5" />,
      className: 'text-gray-600 bg-gray-50 border-gray-200',
    },
  }

  const { icon, className } = config[status] || config.pending

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${className}`}>
      {icon}
      {status}
    </span>
  )
}

export default async function AdminBillingPage() {
  await requirePlatformAdmin()

  const [events, stats] = await Promise.all([getBillingEvents(), getBillingStats()])

  const successRate = stats.total > 0
    ? Math.round((stats.processed / stats.total) * 100)
    : 100

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing Events</h1>
        <p className="text-sm text-gray-500 mt-1">
          Webhook events from billing provider — idempotent ingestion log
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Events</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Processed</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.processed}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-indigo-600">{successRate}%</p>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Webhook className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Recent Webhook Events</h2>
          <span className="ml-auto text-xs text-gray-400">Last 100 events</span>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Activity className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No webhook events recorded yet</p>
            <p className="text-xs mt-1">Events appear as billing provider sends them</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Event ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Received</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Retries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">
                        {event.providerEventId.slice(0, 20)}...
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-800">{event.eventType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 capitalize">{event.provider}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(event.receivedAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {event.retryCount > 0 ? (
                        <span className="text-amber-600 font-medium">{event.retryCount}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhook Config */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Webhook Configuration</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-600">Endpoint URL</span>
            <code className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg font-mono text-gray-800">
              {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/billing/webhook
            </code>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-600">Active Provider</span>
            <span className="text-sm font-semibold text-gray-900 capitalize">
              {process.env.BILLING_PROVIDER || process.env.STRIPE_SECRET_KEY ? 'stripe' : 'mock'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-600">Stripe Configured</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              process.env.STRIPE_SECRET_KEY
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-gray-500 bg-gray-100'
            }`}>
              {process.env.STRIPE_SECRET_KEY ? '✓ Configured' : '✗ Not configured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
