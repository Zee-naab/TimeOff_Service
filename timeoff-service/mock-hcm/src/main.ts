import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── In-memory store ──────────────────────────────────────────────────────────
interface BalanceRecord {
  employeeId: number;
  locationId: number;
  leaveTypeId: number;
  balance: number;
}

const store = new Map<string, BalanceRecord>();

function key(empId: number, locId: number, ltId: number): string {
  return `${empId}_${locId}_${ltId}`;
}

// Seed: 3 employees × 2 locations × 2 leave types
// leaveTypeId 1 = Vacation (10 days), 2 = Sick (5 days)
function seedData(): void {
  for (const empId of [1, 2, 3]) {
    for (const locId of [1, 2]) {
      store.set(key(empId, locId, 1), { employeeId: empId, locationId: locId, leaveTypeId: 1, balance: 10 });
      store.set(key(empId, locId, 2), { employeeId: empId, locationId: locId, leaveTypeId: 2, balance: 5 });
    }
  }
  console.log(`[${new Date().toISOString()}] Seeded ${store.size} balance records`);
}

seedData();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function errorRes(res: Response, statusCode: number, message: string) {
  return res.status(statusCode).json({ success: false, message, statusCode });
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== 'mock-hcm-secret') {
    return errorRes(res, 401, 'Unauthorized: invalid or missing x-api-key header');
  }
  next();
});

// ─── GET /hcm/balance/:employeeId/:locationId/:leaveTypeId ────────────────────
app.get('/hcm/balance/:employeeId/:locationId/:leaveTypeId', (req: Request, res: Response) => {
  const empId = parseInt(req.params.employeeId, 10);
  const locId = parseInt(req.params.locationId, 10);
  const ltId = parseInt(req.params.leaveTypeId, 10);

  if (isNaN(empId) || isNaN(locId) || isNaN(ltId)) {
    return errorRes(res, 400, 'employeeId, locationId and leaveTypeId must be integers');
  }

  const record = store.get(key(empId, locId, ltId));
  if (!record) {
    return errorRes(
      res,
      404,
      `Balance not found for employee=${empId}, location=${locId}, leaveType=${ltId}`,
    );
  }

  return res.json({ success: true, ...record });
});

// ─── POST /hcm/balance/update ─────────────────────────────────────────────────
app.post('/hcm/balance/update', (req: Request, res: Response) => {
  const { employeeId, locationId, leaveTypeId, balance } = req.body;

  if (employeeId == null || locationId == null || leaveTypeId == null || balance == null) {
    return errorRes(res, 400, 'Missing required fields: employeeId, locationId, leaveTypeId, balance');
  }

  if (typeof balance !== 'number' || balance < 0) {
    return errorRes(res, 400, 'balance must be a non-negative number');
  }

  const empId = Number(employeeId);
  const locId = Number(locationId);
  const ltId = Number(leaveTypeId);
  const k = key(empId, locId, ltId);

  const record: BalanceRecord = { employeeId: empId, locationId: locId, leaveTypeId: ltId, balance };
  store.set(k, record);

  return res.json({ success: true, ...record });
});

// ─── POST /hcm/batch ──────────────────────────────────────────────────────────
app.post('/hcm/batch', (_req: Request, res: Response) => {
  const balances = Array.from(store.values());
  return res.json({ success: true, balances });
});

// ─── POST /hcm/simulate/anniversary ──────────────────────────────────────────
app.post('/hcm/simulate/anniversary', (req: Request, res: Response) => {
  const { employeeId, locationId, leaveTypeId, bonusDays } = req.body;

  if (employeeId == null || locationId == null || leaveTypeId == null || bonusDays == null) {
    return errorRes(res, 400, 'Missing required fields: employeeId, locationId, leaveTypeId, bonusDays');
  }

  if (typeof bonusDays !== 'number' || bonusDays <= 0) {
    return errorRes(res, 400, 'bonusDays must be a positive number');
  }

  const empId = Number(employeeId);
  const locId = Number(locationId);
  const ltId = Number(leaveTypeId);
  const k = key(empId, locId, ltId);
  const record = store.get(k);

  if (!record) {
    return errorRes(
      res,
      404,
      `Balance not found for employee=${empId}, location=${locId}, leaveType=${ltId}`,
    );
  }

  record.balance += bonusDays;
  store.set(k, record);

  return res.json({ success: true, ...record, bonusDaysAdded: bonusDays });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Mock HCM Server running on http://localhost:${PORT}`);
});
