# TimeOff Service

A NestJS REST API for managing employee time-off requests and leave balances, with HCM (Human Capital Management) synchronisation. Ships with a separate mock HCM Express server for local development.

## Prerequisites

- Node.js 18+
- npm 9+

## Project Structure

```
timeoff-service/
├── src/
│   ├── database/                   ← Shared database layer
│   │   ├── entities/               ← All TypeORM entity classes
│   │   │   ├── employee.entity.ts
│   │   │   ├── location.entity.ts
│   │   │   ├── leave-type.entity.ts
│   │   │   ├── ledger-entry.entity.ts   ← Balance ledger (replaces leave_balances)
│   │   │   ├── time-off-request.entity.ts
│   │   │   └── sync-log.entity.ts
│   │   ├── repositories/           ← Custom repository classes (all DB queries)
│   │   │   ├── employee.repository.ts
│   │   │   ├── location.repository.ts
│   │   │   ├── leave-type.repository.ts
│   │   │   ├── ledger-entry.repository.ts
│   │   │   ├── time-off-request.repository.ts
│   │   │   └── sync-log.repository.ts
│   │   ├── types/                  ← Shared TypeScript interfaces
│   │   │   ├── balance.types.ts    ← BalanceSummary
│   │   │   └── hcm.types.ts        ← HCM response shapes
│   │   └── database.module.ts      ← Registers all entities + exports all repositories
│   ├── modules/
│   │   ├── employees/              ← Employee CRUD
│   │   ├── locations/              ← Office location CRUD
│   │   ├── leave-types/            ← Leave type CRUD (Vacation, Sick, Personal)
│   │   ├── leave-balances/         ← Balance queries & ledger-entry management
│   │   ├── time-off-requests/      ← Time-off request submission & approval
│   │   └── sync/                   ← HCM sync (realtime & batch)
│   ├── common/
│   │   ├── filters/                ← Global exception filter
│   │   ├── guards/                 ← API key guard
│   │   └── interceptors/           ← HTTP logging interceptor
│   ├── config/
│   │   └── database.config.ts
│   ├── app.module.ts
│   └── main.ts
├── mock-hcm/                       ← Standalone mock HCM Express server
│   ├── src/main.ts
│   └── package.json
├── test/
│   ├── unit/                       ← Unit tests (Jest + mock repositories)
│   └── integration/                ← Integration tests (real SQLite :memory:)
└── .env
```

### Balance Ledger

Leave balances are stored as an **append-only ledger** (`ledger_entries` table) rather than a single mutable row per combination. Every balance change is a new immutable entry:

| Entry Type | When written | `amount` sign |
|------------|-------------|---------------|
| `SYNC` | HCM realtime or batch sync | Delta to HCM value (positive or negative) |
| `DEDUCTION` | Request approved | Negative (days taken) |
| `RESTORATION` | Approved request rejected or cancelled | Positive (days returned) |

**Current balance** = `SELECT SUM(amount) FROM ledger_entries WHERE employee_id=? AND location_id=? AND leave_type_id=?`

Every balance change is auditable by definition — no separate audit log is needed.

### Repository Pattern

All TypeORM queries live in custom repository classes (`src/database/repositories/`). Feature modules import a shared `DatabaseModule` to access them. Services contain only business logic.

```
Controller → Service → Repository → SQLite
```

## Installation

### 1. Install main service dependencies

```bash
cd timeoff-service
npm install
```

### 2. Install mock HCM server dependencies

```bash
cd timeoff-service/mock-hcm
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` (already provided with defaults):

```bash
cp .env.example .env
```

Default `.env` values:

```
PORT=3000
DATABASE_PATH=./timeoff.db
HCM_BASE_URL=http://localhost:4000
HCM_API_KEY=mock-hcm-secret
```

## Running the Mock HCM Server

Start the mock HCM server **before** using the sync endpoints. It seeds 3 employees, 2 locations, and 2 leave types in memory.

```bash
cd timeoff-service/mock-hcm
npm start          # production
npm run dev        # watch mode (nodemon + ts-node)
```

Runs on **http://localhost:4000**

### Mock HCM Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hcm/balance/:employeeId/:locationId/:leaveTypeId` | Get balance for a combination |
| POST | `/hcm/balance/update` | Update a single employee balance |
| POST | `/hcm/batch` | Get all balances at once |
| POST | `/hcm/simulate/anniversary` | Add vacation days for an employee |

All requests require the `x-api-key: mock-hcm-secret` header.

## Running the Main Service

```bash
cd timeoff-service

# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Runs on **http://localhost:3000**

## API Documentation

Interactive Swagger UI is available at:

**http://localhost:3000/api/docs**

## Key API Endpoints

### Employees
| Method | Path | Description |
|--------|------|-------------|
| GET | `/employees` | List all employees |
| GET | `/employees/:id` | Get employee by ID |
| POST | `/employees` | Create employee |
| PUT | `/employees/:id` | Update employee |
| DELETE | `/employees/:id` | Delete employee |

### Leave Balances

`GET` responses return **computed summaries** — balance is derived from `SUM(ledger_entries.amount)` for the combination. `POST` seeds an opening balance. `/:id` endpoints operate on individual ledger entry rows.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/leave-balances` | Computed balance summaries for all (employee, location, leave_type) combinations |
| GET | `/leave-balances/employee/:id` | Computed balance summaries for one employee |
| GET | `/leave-balances/:id` | Get a specific ledger entry by its row ID |
| POST | `/leave-balances` | Seed an opening balance (adds a SYNC ledger entry) |
| PUT | `/leave-balances/:id` | Update a ledger entry's amount (manual correction) |
| DELETE | `/leave-balances/:id` | Remove a specific ledger entry |

### Time Off Requests
| Method | Path | Description |
|--------|------|-------------|
| GET | `/time-off-requests` | List all requests |
| GET | `/time-off-requests/employee/:id` | Requests for one employee |
| POST | `/time-off-requests` | Submit request (validates balance) |
| PATCH | `/time-off-requests/:id/status` | Approve / reject / cancel |
| DELETE | `/time-off-requests/:id` | Delete pending request |

### Sync
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sync/logs` | View all sync log entries |
| POST | `/sync/realtime` | Sync one balance from HCM (appends SYNC ledger entry) |
| POST | `/sync/batch` | Sync all balances from HCM |

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Insufficient balance. Available: 5, Requested: 10",
  "timestamp": "2024-06-01T12:00:00.000Z",
  "path": "/time-off-requests"
}
```

## Running Tests

```bash
cd timeoff-service

# Unit tests (mock repositories, no DB)
npm run test

# Unit tests in watch mode
npm run test:watch

# Unit test coverage
npm run test:cov

# End-to-end tests (requires no running server on port 3000)
npm run test:e2e
```

**33 tests across 6 suites:**

| Suite | Type | Tests |
|-------|------|-------|
| `employees.service.spec.ts` | Unit | 7 |
| `leave-balances.service.spec.ts` | Unit | 3 |
| `time-off-requests.service.spec.ts` | Unit | 8 |
| `sync.service.spec.ts` | Unit | 4 |
| `leave-balance-sync.spec.ts` | Integration | 3 |
| `time-off-request-flow.spec.ts` | Integration | 5 |

Unit tests mock all custom repository classes directly — no `getRepositoryToken` wiring needed. Integration tests run against a real `better-sqlite3` in-memory database with only `HttpService` (HCM calls) mocked via `jest.spyOn`.

## Mock HCM Server Details

The mock HCM server starts with **12 pre-seeded balance records** (3 employees × 2 locations × 2 leave types):

| Employee | Location | Leave Type | Balance |
|----------|----------|------------|---------|
| 1, 2, 3 | 1, 2 | 1 (Vacation) | 10 days |
| 1, 2, 3 | 1, 2 | 2 (Sick) | 5 days |

All requests require the header: `x-api-key: mock-hcm-secret`

### Example curl commands

**Get a specific balance:**
```bash
curl -H "x-api-key: mock-hcm-secret" \
  http://localhost:4000/hcm/balance/1/1/1
# → { "success": true, "employeeId": 1, "locationId": 1, "leaveTypeId": 1, "balance": 10 }
```

**Set a balance manually:**
```bash
curl -X POST http://localhost:4000/hcm/balance/update \
  -H "x-api-key: mock-hcm-secret" \
  -H "Content-Type: application/json" \
  -d '{ "employeeId": 1, "locationId": 1, "leaveTypeId": 1, "balance": 20 }'
```

**Fetch all balances (batch):**
```bash
curl -X POST http://localhost:4000/hcm/batch \
  -H "x-api-key: mock-hcm-secret" \
  -H "Content-Type: application/json"
# → { "success": true, "balances": [ ... all 12 records ... ] }
```

**Simulate a work anniversary bonus (+3 Vacation days for employee 1 at location 1):**
```bash
curl -X POST http://localhost:4000/hcm/simulate/anniversary \
  -H "x-api-key: mock-hcm-secret" \
  -H "Content-Type: application/json" \
  -d '{ "employeeId": 1, "locationId": 1, "leaveTypeId": 1, "bonusDays": 3 }'
# → { "success": true, ..., "balance": 13, "bonusDaysAdded": 3 }
```

After running the anniversary endpoint, call `POST /sync/realtime` in the main service to pull the updated balance into the local ledger.

## Typical Dev Workflow

1. Start the mock HCM server: `cd mock-hcm && npm start`
2. Start the main service: `cd .. && npm run start:dev`
3. Open Swagger UI at http://localhost:3000/api/docs
4. Create employees, locations, and leave types via the API
5. Seed leave balance records via `POST /leave-balances`, or use `POST /sync/batch` to pull all balances from HCM
6. Submit time-off requests and approve/reject them
7. Run `POST /sync/realtime` after an anniversary bonus to pull the updated balance into the local ledger
