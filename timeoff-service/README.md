# TimeOff Service

A NestJS REST API for managing employee time-off requests, leave balances, and HCM (Human Capital Management) synchronization. Ships with a separate mock HCM Express server for local development.

## Prerequisites

- Node.js 18+
- npm 9+

## Project Structure

```
timeoff-service/
├── src/
│   ├── modules/
│   │   ├── employees/          ← Employee CRUD
│   │   ├── locations/          ← Office location CRUD
│   │   ├── leave-types/        ← Leave type CRUD (Vacation, Sick, Personal)
│   │   ├── leave-balances/     ← Employee leave balance management
│   │   ├── time-off-requests/  ← Time-off request submission & approval
│   │   └── sync/               ← HCM sync (realtime & batch)
│   ├── common/
│   │   ├── filters/            ← Global exception filter
│   │   ├── guards/             ← API key guard
│   │   └── interceptors/       ← HTTP logging interceptor
│   ├── config/
│   │   └── database.config.ts
│   ├── app.module.ts
│   └── main.ts
├── mock-hcm/                   ← Standalone mock HCM Express server
│   ├── src/main.ts
│   └── package.json
├── test/
│   ├── unit/                   ← Unit tests (jest)
│   └── e2e/                    ← End-to-end tests (supertest)
└── .env
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
npm run start:dev  # watch mode (ts-node-dev)
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
| Method | Path | Description |
|--------|------|-------------|
| GET | `/leave-balances` | List all balances |
| GET | `/leave-balances/employee/:id` | Balances for one employee |
| POST | `/leave-balances` | Create balance record |
| PUT | `/leave-balances/:id` | Update balance |

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
| POST | `/sync/realtime` | Sync one balance from HCM |
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

# Unit tests
npm run test

# Unit tests in watch mode
npm run test:watch

# Unit test coverage
npm run test:cov

# End-to-end tests (requires no running server on port 3000)
npm run test:e2e
```

## Typical Dev Workflow

1. Start the mock HCM server: `cd mock-hcm && npm start`
2. Start the main service: `cd .. && npm run start:dev`
3. Open Swagger UI at http://localhost:3000/api/docs
4. Create employees, locations, and leave types via the API
5. Create leave balance records, or use `POST /sync/batch` to pull all balances from HCM
6. Submit time-off requests and approve/reject them
