# Production Deployment & Infrastructure Architecture

## 1. Environment & Connection Architecture

The platform uses a dual-database URL architecture for optimal connection pooling and zero-downtime serverless execution:

```
                  ┌───────────────────────────────┐
                  │   Next.js Edge / Node.js      │
                  │   Server Actions & APIs       │
                  └──────────────┬────────────────┘
                                 │
                 DATABASE_URL (Port 6543)
                  PgBouncer Transaction Pool
                                 │
                  ┌──────────────▼────────────────┐
                  │    Supabase / PostgreSQL      │
                  │    Connection Pooler          │
                  └──────────────┬────────────────┘
                                 │
                  DIRECT_URL (Port 5432 - Direct)
                  Prisma Migrations & Admin DDL
                                 │
                  ┌──────────────▼────────────────┐
                  │    Primary Database Cluster   │
                  │    PostgreSQL 15+ with RLS    │
                  └───────────────────────────────┘
```

---

## 2. Environment Variables Specification

| Variable Name | Environment | Required | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | All | Yes | Transaction-pooled PostgreSQL connection string (Port 6543) |
| `DIRECT_URL` | All | Yes | Direct connection string for schema migrations and DDL (Port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Yes | Public Supabase API project endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Yes | Public anonymous JWT API key for browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Yes | Elevated service role key for auth & background tasks |
| `PLATFORM_ADMIN_EMAILS` | Server Only | Yes | Comma-separated platform administrator emails whitelist |
| `NODE_ENV` | Production | Yes | Set to `production` |

---

## 3. SaaS Security Boundaries & Multi-Tenant Isolation

1. **Authoritative Server Actions**:
   All operations invoke `requireBusinessAccess(businessId)` or `requirePlatformAdmin()` before executing queries.
2. **Platform vs Tenant Separation**:
   Platform administrators cannot view or modify tenant financial journal lines or customer accounts without explicit tenant contextual impersonation.
3. **Tenant Quota Enforcement**:
   Hard resource limits (Users, Invoices, Warehouses) are authoritatively enforced at the service layer (`UsageService.assertQuota`).
4. **Health Monitoring**:
   Public health endpoint (`/api/health`) provides telemetry without leaking credentials or database connection strings.
