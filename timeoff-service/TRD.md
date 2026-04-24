# Time-Off Microservice — Technical Requirements Document

**Version:** 1.1  
**Date:** April 2026  
**Status:** Final

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [System Architecture](#3-system-architecture)
4. [Data Model](#4-data-model)
5. [API Design](#5-api-design)
6. [Sync Strategy](#6-sync-strategy)
7. [Security Considerations](#7-security-considerations)
8. [Error Handling](#8-error-handling)
9. [Test Strategy](#9-test-strategy)
10. [Alternatives Considered](#10-alternatives-considered)
11. [Future Improvements](#11-future-improvements)
12. [Running the Project](#12-running-the-project)

---

## 1. Overview

The **Time-Off Microservice** is a NestJS REST API that manages employee time-off requests and leave balance tracking for the ExampleHR platform. It acts as the operational layer between end users (employees and managers) and the authoritative HR data stored in an external Human Capital Management (HCM) system such as Workday or SAP SuccessFactors.

### What it does

- Stores and serves employee leave balances locally for fast, resilient access
- Accepts and validates time-off requests against available balance
- Enforces a status lifecycle (Pending → Approved / Rejected / Cancelled)
- Synchronises balances from HCM on demand (realtime) or in bulk (batch)
- Logs every sync operation for auditability

### Where it fits

ExampleHR is the employee-facing HR platform. The HCM system is the company-wide source of truth for payroll and leave entitlements. This microservice sits between the two — it owns the request workflow and maintains a local copy of balances to avoid a hard dependency on HCM availability for every user action.

### Who uses it

| Actor | Actions |
|-------|---------|
| **Employee** | View their leave balance, submit time-off requests, cancel their own requests |
| **Manager** | Approve or reject requests from their team, trigger a realtime balance sync before making a decision |
| **System / Scheduler** | Trigger batch sync after HCM runs anniversary bonuses or year-start resets |

---

## 2. Problem Statement

### 2.1 Balance synchronisation across two independent systems

ExampleHR and HCM maintain overlapping data about leave balances. HCM is updated by payroll events (anniversary bonuses, year-start resets, corrections) without notifying ExampleHR. This creates a window where ExampleHR's local copy is stale. The service must handle this gracefully — accepting that the local balance may lag behind HCM and providing a sync mechanism to reconcile differences.

### 2.2 HCM does not push changes

Most enterprise HCM systems (Workday, SAP) do not support outbound webhooks for balance changes. ExampleHR cannot subscribe to HCM events. Synchronisation must be pull-based: ExampleHR periodically or on-demand asks HCM for the latest balances.

### 2.3 Defensive validation is required

HCM does not always return validation errors for edge cases. Requests that look valid to HCM may still be incorrect from ExampleHR's perspective (e.g. requesting leave for a location the employee is not assigned to). The microservice must validate all input locally before forwarding any action to HCM.

### 2.4 Balances are not global — they are scoped per combination

An employee may work across multiple office locations and may be entitled to multiple leave types (Vacation, Sick, Personal). A leave balance is specific to a single `(employee, location, leave_type)` combination. A request to take Vacation in New York does not reduce the employee's Vacation balance in London. The data model and all validation logic must respect this three-way scope.

### 2.5 Race condition: concurrent requests can over-deduct balance

If two time-off requests are submitted near-simultaneously, both may pass the initial balance check (e.g. both see 10 available days and both request 8). Without a guard at approval time, both approvals could succeed, deducting 16 days from a balance of 10. The service addresses this by re-checking the live local balance at the point of deduction inside `updateStatus`, not just at request creation.

---

## 3. System Architecture

### Component overview

```
  ┌─────────────────────────┐
  │   Employee / Manager    │
  │       (HTTP Client)     │
  └────────────┬────────────┘
               │  REST (JSON)
               ▼
  ┌────────────────────────────────────┐
  │      Time-Off Microservice         │
  │           (NestJS)                 │
  │                                    │
  │  ┌──────────┐  ┌────────────────┐  │
  │  │  Request │  │  Sync Service  │  │
  │  │  Handler │  │  (HttpService) │  │
  │  └──────────┘  └───────┬────────┘  │
  │         │              │           │
  │         ▼              │           │
  │  ┌─────────────┐       │           │
  │  │  SQLite DB  │       │           │
  │  │  (TypeORM)  │       │           │
  │  └─────────────┘       │           │
  └────────────────────────┼───────────┘
                           │  REST (x-api-key)
                           ▼
               ┌───────────────────────┐
               │    HCM System         │
               │  (Mock / Workday /    │
               │   SAP SuccessFactors) │
               └───────────────────────┘
```

### Component responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Time-Off Microservice** | Business logic, request validation, balance enforcement, sync orchestration |
| **SQLite Database** | Local persistence of all entities; append-only ledger of balance changes |
| **HCM System** | Authoritative source of truth for leave entitlements and balances |
| **Mock HCM Server** | Standalone Express server that simulates HCM for local development and testing |

### Source structure

The service enforces a strict three-layer separation inside `src/`:

```
src/
├── database/
│   ├── entities/         ← All TypeORM entity classes (single source of truth)
│   ├── repositories/     ← Custom repository classes (all DB queries live here)
│   ├── types/            ← Shared TypeScript interfaces (BalanceSummary, HCM shapes)
│   └── database.module.ts← Single TypeOrmModule.forFeature + exports all repositories
├── modules/
│   ├── employees/        ← Controller + Service + DTOs (no entity files)
│   ├── locations/
│   ├── leave-types/
│   ├── leave-balances/
│   ├── time-off-requests/
│   └── sync/
└── common/               ← Guards, filters, interceptors
```

Each feature module imports `DatabaseModule` to get access to all repository providers. Services contain only business logic (validation, error throwing, orchestration); all TypeORM queries are encapsulated in repository classes.

### Key design principle

The microservice never writes balances to HCM — it only reads from it. All writes (appending ledger entries on approval, restoration, or sync) happen in the local SQLite database only. HCM is treated as read-only from this service's perspective, and a sync always flows in one direction: **HCM → local DB**.

---

## 4. Data Model

### Entity relationship overview

```
Employee ──< LedgerEntry >── Location
                │
            LeaveType
            TimeOffRequest (nullable FK)

Employee ──< TimeOffRequest >── Location
                │
            LeaveType
            Manager (Employee, nullable)

SyncLog (standalone audit table)
```

### 4.1 Employee

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `name` | varchar | NOT NULL |
| `email` | varchar | NOT NULL, UNIQUE |
| `created_at` | timestamp | auto |

### 4.2 Location

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `name` | varchar | NOT NULL |
| `created_at` | timestamp | auto |

### 4.3 LeaveType

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `name` | varchar | NOT NULL (e.g. Vacation, Sick, Personal) |
| `created_at` | timestamp | auto |

### 4.4 LedgerEntry

The central entity. Replaces the old single-row `LeaveBalance` table with an append-only ledger. Every change to a balance — whether from an HCM sync, an approval deduction, or a rejection/cancellation restoration — is recorded as a separate row. The current balance for any `(employee, location, leave_type)` combination is always derived by `SUM(amount)` across all matching rows.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `employee_id` | FK → Employee | NOT NULL |
| `location_id` | FK → Location | NOT NULL |
| `leave_type_id` | FK → LeaveType | NOT NULL |
| `amount` | decimal(10,2) | NOT NULL — positive = credit, negative = debit |
| `entry_type` | enum | NOT NULL — `SYNC`, `DEDUCTION`, or `RESTORATION` |
| `time_off_request_id` | FK → TimeOffRequest | nullable — set on DEDUCTION / RESTORATION entries |
| `created_at` | timestamp | auto |

**No unique constraint** — multiple rows per `(employee, location, leave_type)` are expected and required.

**Entry types:**

| Type | When written | Amount |
|------|-------------|--------|
| `SYNC` | HCM realtime or batch sync | Delta from current balance to HCM-reported value |
| `DEDUCTION` | Time-off request is approved | Negative (days taken) |
| `RESTORATION` | Approved request is rejected or cancelled | Positive (days returned) |

**Balance computation:**
```sql
SELECT COALESCE(SUM(amount), 0)
FROM ledger_entries
WHERE employee_id = ? AND location_id = ? AND leave_type_id = ?
```

**Why a ledger instead of a single mutable row:**  
A mutable balance row requires an UPDATE for every change, which loses the history of how the balance arrived at its current value. The ledger approach records every change as a new immutable row — deductions, restorations, and sync corrections are all first-class facts. This provides a full audit trail without any additional infrastructure. The current balance is always computable from the ledger's SUM, and `last_synced_at` is derivable from the most recent SYNC entry's `created_at`.

**Why balances are stored locally:**  
Querying HCM live for every page load or balance check is impractical. HCM systems are often slow (>500 ms), rate-limited, or temporarily unavailable. Storing a local ledger means employees can always view their balance and submit requests even if HCM is down. The sync mechanism ensures the ledger stays reasonably current. This is a deliberate trade-off: slight staleness in exchange for resilience and speed.

### 4.5 TimeOffRequest (unchanged)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `employee_id` | FK → Employee | NOT NULL |
| `location_id` | FK → Location | NOT NULL |
| `leave_type_id` | FK → LeaveType | NOT NULL |
| `manager_id` | FK → Employee | nullable |
| `start_date` | date | NOT NULL |
| `end_date` | date | NOT NULL |
| `days_requested` | decimal(10,2) | NOT NULL, ≥ 0.5 |
| `status` | enum | NOT NULL, default `PENDING` |
| `hcm_synced` | boolean | default `false` |
| `created_at` | timestamp | auto |
| `updated_at` | timestamp | auto |

**Status state machine:**

```
                ┌─────────┐
                │ PENDING │
                └────┬────┘
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      APPROVED    REJECTED   CANCELLED
          │
     ┌────┴────┐
     ▼         ▼
 REJECTED  CANCELLED
```

- `PENDING → APPROVED`: balance is deducted
- `APPROVED → REJECTED`: balance is restored
- `APPROVED → CANCELLED`: balance is restored
- `CANCELLED → *`: not allowed (terminal state)

### 4.6 SyncLog (unchanged)

Audit record written after every sync operation, regardless of outcome.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | PK, auto-increment |
| `type` | enum | `REALTIME` or `BATCH` |
| `status` | enum | `SUCCESS` or `FAILED` |
| `details` | text | nullable — JSON with counts or error message |
| `created_at` | timestamp | auto |

---

## 5. API Design

Base URL: `http://localhost:3000`  
Interactive docs: `http://localhost:3000/api/docs` (Swagger UI)

### 5.1 Employees

Standard CRUD. Used by HR administrators to maintain the employee roster.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/employees` | List all employees |
| GET | `/employees/:id` | Get employee by ID |
| POST | `/employees` | Create a new employee |
| PUT | `/employees/:id` | Update employee name or email |
| DELETE | `/employees/:id` | Remove an employee |

### 5.2 Locations

Standard CRUD. Used to manage office locations.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/locations` | List all locations |
| GET | `/locations/:id` | Get location by ID |
| POST | `/locations` | Create a location |
| PUT | `/locations/:id` | Update location name |
| DELETE | `/locations/:id` | Remove a location |

### 5.3 Leave Types

Standard CRUD. Defines the categories of leave (Vacation, Sick, Personal, etc.).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/leave-types` | List all leave types |
| GET | `/leave-types/:id` | Get leave type by ID |
| POST | `/leave-types` | Create a leave type |
| PUT | `/leave-types/:id` | Update leave type name |
| DELETE | `/leave-types/:id` | Remove a leave type |

### 5.4 Leave Balances

Balance query and ledger-entry management endpoints. `GET` responses return **computed summaries** (current balance derived from the ledger SUM, plus `last_synced_at`). `POST` adds an initial SYNC ledger entry. `GET/PUT/DELETE /:id` operate on individual ledger entry rows by their entry ID.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/leave-balances` | List computed balance summaries for all (employee, location, leave_type) combinations |
| GET | `/leave-balances/employee/:employeeId` | Computed balance summaries for one employee |
| GET | `/leave-balances/:id` | Get a specific ledger entry by its row ID |
| POST | `/leave-balances` | Add an initial SYNC ledger entry (sets opening balance) |
| PUT | `/leave-balances/:id` | Update the amount of a specific ledger entry (manual correction) |
| DELETE | `/leave-balances/:id` | Remove a specific ledger entry |

### 5.5 Time Off Requests

The primary workflow endpoint. Used by employees (submit, cancel) and managers (approve, reject).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/time-off-requests` | List all requests |
| GET | `/time-off-requests/:id` | Get request by ID |
| GET | `/time-off-requests/employee/:employeeId` | All requests for one employee |
| POST | `/time-off-requests` | Submit a new request (validates balance) |
| PATCH | `/time-off-requests/:id/status` | Change request status (approve / reject / cancel) |
| DELETE | `/time-off-requests/:id` | Delete a pending request |

### 5.6 Sync

Used by managers or scheduled jobs to pull fresh data from HCM.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sync/logs` | View all sync log entries, newest first |
| POST | `/sync/realtime` | Sync one specific balance from HCM |
| POST | `/sync/batch` | Sync all balances from HCM in one call |

**POST /sync/realtime** request body:
```json
{ "employee_id": 1, "location_id": 1, "leave_type_id": 1 }
```

---

## 6. Sync Strategy

### 6.1 Realtime Sync

**When it is used:**
- A manager wants to verify the latest balance before approving a request
- An employee checks their balance after an expected HCM update (e.g. after their anniversary date)
- Triggered manually via `POST /sync/realtime`

**How it works:**

```
Manager triggers POST /sync/realtime
         │
         ▼
SyncService calls GET /hcm/balance/:e/:l/:lt
  with x-api-key header
         │
    ┌────┴────┐
  Success   Error
    │           │
    ▼              ▼
Compute delta   Write FAILED
= HCM - local   SyncLog entry
Append SYNC     (do not crash)
ledger entry
    │
    ▼
Write SUCCESS SyncLog entry
Return log to caller
```

**Pros:** Balance is guaranteed fresh at the moment of the call.  
**Cons:** Each call adds one outbound HTTP request (~100–500 ms latency depending on HCM).

---

### 6.2 Batch Sync

**When it is used:**
- Scheduled nightly job (e.g. midnight cron) to refresh all balances
- After HCM runs a bulk event (year-start reset, mass anniversary bonus)
- Triggered manually via `POST /sync/batch`

**How it works:**

```
Scheduler triggers POST /sync/batch
         │
         ▼
SyncService calls POST /hcm/batch
         │
    ┌────┴────┐
  Success   Error
    │           │
    ▼           ▼
For each balance  Write FAILED
in response:      SyncLog entry
  compute delta
  append SYNC
  ledger entry
    │
    ▼
Write SUCCESS SyncLog
{ totalSynced: N }
```

**Pros:** Refreshes every balance in a single round-trip. Keeps the entire local DB current.  
**Cons:** There is always some staleness between scheduled runs. A balance changed in HCM at 11 PM will not be reflected locally until midnight.

---

### 6.3 Conflict Resolution

HCM is always the source of truth. The local balance exists solely for speed and resilience — it is not independently authoritative.

| Scenario | Resolution |
|----------|-----------|
| Computed ledger balance is insufficient | Reject request immediately. Do not call HCM. |
| Ledger balance says OK, HCM disagrees | HCM wins. The deduction is rejected. A FAILED sync log is written. |
| HCM is unreachable | Log FAILED. Ledger is unchanged. Request stays PENDING. |
| HCM returns a higher balance than computed local | A positive SYNC delta entry is appended on next sync. |
| HCM returns a lower balance than computed local | A negative SYNC delta entry is appended on next sync. |

This strategy means the local ledger is always updated from HCM, never the reverse. The SYNC entry records the exact delta (`hcmBalance − currentLedgerBalance`), so the running SUM always converges to the HCM-reported value after each sync.

---

## 7. Security Considerations

### HCM authentication

All outbound calls to HCM include an `x-api-key` header. The key is stored in the `.env` file as `HCM_API_KEY` and loaded via `@nestjs/config`. It is never logged or returned in API responses.

### Input validation

Every endpoint uses class-validator DTOs with:
- `whitelist: true` — strips any fields not declared in the DTO
- `forbidNonWhitelisted: true` — rejects requests containing undeclared fields
- `transform: true` + `enableImplicitConversion: true` — safely coerces types (e.g. string path params to numbers)

### Error response safety

The global `GlobalExceptionFilter` intercepts all unhandled exceptions and returns a sanitised response. Stack traces and internal error details are never exposed to clients:

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal server error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/time-off-requests"
}
```

### Logging

The `LoggingInterceptor` logs `METHOD /path STATUS +Nms` for every request. No request bodies, no balance values, no personal data are included in log output.

### CORS

CORS is enabled globally via `app.enableCors()`. In a production deployment, the `origin` option should be restricted to the known ExampleHR frontend domain.

---

## 8. Error Handling

### Standard error response format

All errors — validation failures, not-found, conflicts, internal errors — return the same JSON shape:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Insufficient balance. Available: 3, Requested: 5",
  "timestamp": "2024-06-01T12:00:00.000Z",
  "path": "/time-off-requests"
}
```

### Error scenarios

| Scenario | HTTP Status | Who handles it |
|----------|------------|----------------|
| Balance is insufficient for request | `400 Bad Request` | `TimeOffRequestsService.create()` |
| `start_date` is after `end_date` | `400 Bad Request` | `TimeOffRequestsService.create()` |
| Request body fails DTO validation | `400 Bad Request` | `ValidationPipe` |
| Employee / Location / LeaveType not found | `404 Not Found` | Service `findOne()` methods |
| No ledger entries exist for the combination | `400 Bad Request` | `LeaveBalancesService` |
| Opening balance already exists for the combination | `400 Bad Request` | `LeaveBalancesService.create()` |
| Duplicate employee email | `409 Conflict` | `EmployeesService.create()` |
| Trying to change a CANCELLED request | `409 Conflict` | `TimeOffRequestsService.updateStatus()` |
| HCM is unreachable | No HTTP error to client | Caught in `SyncService`; writes `FAILED` SyncLog |
| HCM returns an error response | `FAILED` SyncLog | `SyncService` catch block; details stored in log |
| Any unhandled exception | `500 Internal Server Error` | `GlobalExceptionFilter` |

HCM communication errors intentionally do not crash the service. The error is recorded in the SyncLog so operators can investigate, and the local database remains in its last known state.

---

## 9. Test Strategy

The project uses a three-tier testing approach with 33 tests across 6 suites.

### 9.1 Unit Tests — 24 tests

| Suite | Tests | What is covered |
|-------|-------|----------------|
| `employees.service.spec.ts` | 7 | `findAll`, `findOne` (success + 404), `create` (success + 409), `remove` (success + 404) |
| `leave-balances.service.spec.ts` | 5 | `findOne` (success + 404), `deductBalance` (success, insufficient, missing record) |
| `time-off-requests.service.spec.ts` | 8 | Create (sufficient / insufficient / bad dates / no record), `findOne` 404, approve deducts, reject restores, cancel restores, ConflictException on CANCELLED |
| `sync.service.spec.ts` | 4 | Realtime SUCCESS, realtime FAILED, batch upserts all records, batch handles empty response |

**Approach:** Each service is tested in complete isolation. All custom repository classes (`EmployeeRepository`, `LedgerEntryRepository`, etc.) and all injected services are replaced with Jest factory mocks — no TypeORM token gymnastics needed. No database, no HTTP, no NestJS runtime overhead. Tests run in ~10 seconds.

### 9.2 Integration Tests — 8 tests

| Suite | Tests | What is covered |
|-------|-------|----------------|
| `leave-balance-sync.spec.ts` | 3 | Realtime sync updates DB record, batch sync updates all DB records, anniversary bonus reflected after sync |
| `time-off-request-flow.spec.ts` | 5 | Approve deducts balance, reject restores, cancel restores, creation fails when balance exceeded, race-condition guard prevents over-deduction |

**Approach:** A real NestJS `TestingModule` is bootstrapped with all application modules (including `DatabaseModule`) and a `better-sqlite3` in-memory database (`database: ':memory:'`). Only `HttpService` (HCM calls) is mocked using `jest.spyOn`. Every test verifies actual database state after the operation. The `ledger_entries` table (and other tables) are truncated in `beforeEach` for isolation. Tests run in ~30 seconds.

### 9.3 E2E Tests

`test/e2e/app.e2e-spec.ts` uses Supertest to fire real HTTP requests at a live NestJS application instance. Covers: returning 200 arrays, creating entities with 201, duplicate email returning 409, non-existent ID returning 404, invalid email returning 400, missing required fields returning 400.

### 9.4 Mock HCM Server

The standalone Express server in `mock-hcm/` simulates HCM for **manual testing and local development**. It is not required for the automated test suite (all HCM calls are mocked at the `HttpService` level in unit and integration tests).

| Feature | Detail |
|---------|--------|
| Seed data | 12 balance records: employees 1–3, locations 1–2, Vacation (10d) + Sick (5d) |
| Auth | Validates `x-api-key: mock-hcm-secret` on every request; returns 401 otherwise |
| Anniversary simulation | `POST /hcm/simulate/anniversary` adds bonus days to a specific balance in-memory |
| Request logging | Every request logged with ISO timestamp to stdout |

---

## 10. Alternatives Considered

### Alternative 1: Always query HCM live — no local balance storage

**Approach:** Remove the local `ledger_entries` table. Every balance check calls HCM directly.

| | Detail |
|-|--------|
| **Pro** | Balance is always 100% accurate. No sync complexity, no ledger to maintain. |
| **Con** | Every employee page load depends on HCM availability. If HCM is slow (>1s) or down, employees cannot view their balance or submit requests. HCM rate limits become a service-level concern. |
| **Decision** | **Rejected.** Tight coupling to HCM availability is unacceptable for a user-facing service. Local storage with sync is the industry-standard pattern for this problem. |

---

### Alternative 2: Event-driven sync — HCM pushes balance changes via webhooks

**Approach:** HCM calls a webhook endpoint on ExampleHR whenever a balance changes (anniversary, reset, correction).

| | Detail |
|-|--------|
| **Pro** | Instant consistency. Local DB is updated the moment HCM changes. No polling. |
| **Con** | Most enterprise HCM systems (Workday, SAP SuccessFactors) do not support outbound webhooks for balance events. Even when they do, webhook reliability requires retry queues and dead-letter handling, adding significant infrastructure complexity. |
| **Decision** | **Rejected for this iteration.** The pull-based sync approach works with any HCM system regardless of its capabilities. Webhooks can be added as a future enhancement if the HCM system supports them. |

---

### Alternative 3: GraphQL instead of REST

**Approach:** Expose a GraphQL API so clients can query exactly the fields they need.

| | Detail |
|-|--------|
| **Pro** | Flexible queries, no over-fetching, self-documenting schema. |
| **Con** | Higher implementation complexity (resolvers, schema definition, N+1 problem management). Overkill for a microservice with a well-defined, stable set of operations. Swagger coverage of REST is simpler for an API that backend teams consume. |
| **Decision** | **Rejected.** REST with Swagger is sufficient and more familiar to the target audience. |

---

### Alternative 4: PostgreSQL instead of SQLite

**Approach:** Use PostgreSQL as the primary database.

| | Detail |
|-|--------|
| **Pro** | Better concurrent write handling, row-level locking, production-grade reliability, easier horizontal scaling. |
| **Con** | Requires a separate database server, container, connection pooling setup. Unnecessary overhead for an assessment or early-stage service with low write volume. |
| **Decision** | **SQLite used per assessment requirements.** TypeORM abstracts the database layer entirely — the only change needed to switch to PostgreSQL is the `type`, `host`, `port`, `username`, `password`, and `database` fields in the TypeORM configuration. No service or entity code changes required. |

---

## 11. Future Improvements

| Priority | Improvement | Rationale |
|----------|-------------|-----------|
| High | **Scheduled batch sync** via cron (`@nestjs/schedule`) | Automates the nightly refresh without manual intervention |
| High | **Switch to PostgreSQL** for production deployment | Better concurrency guarantees; row-level locking eliminates the race-condition risk at the database level |
| Medium | **Role-based access control** (Employee vs Manager vs Admin) | Employees should not be able to approve their own requests; managers should only see their team |
| Medium | **Redis cache** for high-traffic balance lookups | Avoids repeated DB reads on the `SUM(amount)` query for frequently accessed balances |
| Medium | **Webhook receiver** for HCM push notifications | Eliminates polling latency when the HCM system supports outbound events |
| Medium | **Ledger compaction** (periodic snapshot) | After the ledger grows large, periodically materialise a snapshot row so SUM only spans recent entries |
| Low | **Soft deletes** on employees and requests | Preserves historical data for reporting instead of hard-deleting records |
| Low | **Pagination** on list endpoints | Required once employee and request counts grow beyond a few hundred |

> **Note — Audit trail:** The `ledger_entries` table is itself the audit trail. Every balance change (SYNC, DEDUCTION, RESTORATION) is an immutable append-only row with a timestamp and an optional link to the triggering `TimeOffRequest`. No separate audit log table is needed.

---

## 12. Running the Project

See [README.md](./README.md) for full installation and startup instructions.

### Quick reference

```bash
# 1. Install dependencies
cd timeoff-service && npm install
cd mock-hcm && npm install

# 2. Start mock HCM server (port 4000)
cd mock-hcm && npm run dev

# 3. Start main service (port 3000)
cd timeoff-service && npm run start:dev

# 4. Open Swagger UI
open http://localhost:3000/api/docs

# 5. Run test suite
npm test                  # unit + integration (33 tests)
npm run test:cov          # with coverage report
npm run test:e2e          # end-to-end via Supertest
```

### Environment variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the main service listens on |
| `DATABASE_PATH` | `./timeoff.db` | SQLite database file path |
| `HCM_BASE_URL` | `http://localhost:4000` | Base URL of the HCM server |
| `HCM_API_KEY` | `mock-hcm-secret` | API key sent in `x-api-key` header to HCM |
