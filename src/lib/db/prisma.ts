import { PrismaClient } from '@prisma/client'

// ─────────────────────────────────────────────────────────────
// Prisma Singleton — prevents multiple instances during dev
// hot-reload which exhausts PgBouncer session pool limits.
// ─────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    // Only log errors in dev — query logging creates extra
    // connection overhead and fills the PgBouncer session pool.
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = (globalForPrisma.prisma ?? createPrismaClient()) as PrismaClient & Record<string, any>

// Reuse the same instance across hot reloads in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
