# Disaster Recovery & Database Backup Readiness Runbook

## Overview
This document outlines the backup retention schedule, point-in-time recovery (PITR) strategy, migration safeguards, and disaster recovery procedures for the AccountFlow Multi-Tenant SaaS ERP platform.

---

## 1. Backup Strategy & Retention Architecture

| Backup Level | Frequency | Retention Window | Storage Engine | Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Continuous WAL Archival (PITR)** | Real-time stream | 7 to 30 Days | S3 / GCS Encrypted Storage | Point-in-time restoration down to exact second |
| **Automated Daily Snapshots** | Daily @ 02:00 UTC | 30 Days | Multi-Region Encrypted Storage | Full database dump (Prisma schema + data) |
| **Weekly Deep Archive** | Every Sunday | 1 Year | Cold / Glacier Archive | Full encrypted snapshot for regulatory compliance |
| **Pre-Migration Snapshot** | Pre-deployment hook | 14 Days | Fast SSD Snapshot | Automatic snapshot before any `prisma migrate` run |

---

## 2. Disaster Recovery Procedures

### Scenario A: Accidental Tenant Corruption or Data Incident
1. **Identify Timestamp**: Determine the exact ISO timestamp immediately preceding the incident using the immutable `AuditLog` table.
2. **Spin Up Recovery Target**: Launch a restored database branch to the specified PITR timestamp using:
   ```bash
   # Supabase / AWS RDS PITR restore command
   pg_restore --host=dr-replica.db.internal --dbname=accounting_recovered ...
   ```
3. **Scoped Tenant Extraction**:
   Extract solely the affected tenant records using scoped `business_id` filters to prevent overwriting other tenant transactions:
   ```sql
   COPY (SELECT * FROM journal_entries WHERE business_id = 'TARGET_UUID') TO '/tmp/tenant_journals.sql';
   ```
4. **Replay & Verify**: Validate double-entry balance using `ReportingService.getTrialBalance(businessId)` before releasing the tenant back to active status.

---

### Scenario B: Complete Regional Failure
1. Switch DNS records to failover cluster (Traffic routing via Cloudflare/AWS Route53).
2. Promote Warm Standby Database Replica to Primary.
3. Update connection pooler endpoints (`DATABASE_URL` / `DIRECT_URL`).
4. Execute Health Check verification (`GET /api/health`).
5. Confirm status: `200 OK` with 0ms query degradation.

---

## 3. Migration Safety Checklist
- [x] All schema changes are backward-compatible.
- [x] Pre-migration automatic snapshot taken.
- [x] Zero-downtime column additions (`DEFAULT` values provided, non-blocking DDL).
- [x] Validation suite executed (`validate-phase14.ts`) to confirm 100% integrity.
