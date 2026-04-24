import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// In-memory storage for employee balances
// Structure: { "employeeId_locationId_leaveTypeId": balance }
const db = new Map<string, number>();

// Seed mock data
function seedData() {
  // Employees: 1, 2, 3
  // Locations: 1, 2
  // LeaveTypes: 1 (Vacation), 2 (Sick)

  db.set('1_1_1', 15.0); // Employee 1, Loc 1, Vacation -> 15 days
  db.set('1_1_2', 5.0);  // Employee 1, Loc 1, Sick -> 5 days

  db.set('2_1_1', 10.0);
  db.set('2_1_2', 3.0);

  db.set('3_2_1', 20.0);
  db.set('3_2_2', 10.0);
  console.log('Mock database seeded.');
}

seedData();

// Middleware to check API key
function checkAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'mock-hcm-secret') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

app.use(checkAuth);

// GET /hcm/balance/:employeeId/:locationId/:leaveTypeId -> returns balance
app.get('/hcm/balance/:employeeId/:locationId/:leaveTypeId', (req: Request, res: Response) => {
  const { employeeId, locationId, leaveTypeId } = req.params;
  const key = `${employeeId}_${locationId}_${leaveTypeId}`;

  if (db.has(key)) {
    return res.json({ success: true, balance: db.get(key) });
  }

  return res.status(404).json({ success: false, message: 'Balance not found for the given combination' });
});

// POST /hcm/balance/update -> updates a single employee balance
// Expected body: { employeeId, locationId, leaveTypeId, amount, operation: 'add' | 'subtract' | 'set' }
app.post('/hcm/balance/update', (req: Request, res: Response) => {
  const { employeeId, locationId, leaveTypeId, amount, operation } = req.body;
  
  if (!employeeId || !locationId || !leaveTypeId || amount === undefined || !operation) {
    return res.status(400).json({ success: false, message: 'Missing required parameters' });
  }

  const key = `${employeeId}_${locationId}_${leaveTypeId}`;
  let currentBalance = db.has(key) ? db.get(key)! : 0;

  if (operation === 'subtract' && currentBalance < amount) {
    return res.status(400).json({ success: false, message: 'Insufficient balance' });
  }

  if (operation === 'add') {
    currentBalance += amount;
  } else if (operation === 'subtract') {
    currentBalance -= amount;
  } else if (operation === 'set') {
    currentBalance = amount;
  } else {
    return res.status(400).json({ success: false, message: 'Invalid operation' });
  }

  db.set(key, currentBalance);
  return res.json({ success: true, balance: currentBalance });
});

// POST /hcm/batch -> returns all balances at once
app.post('/hcm/batch', (req: Request, res: Response) => {
  const balances = [];
  for (const [key, balance] of db.entries()) {
    const [employeeId, locationId, leaveTypeId] = key.split('_');
    balances.push({
      employeeId: parseInt(employeeId),
      locationId: parseInt(locationId),
      leaveTypeId: parseInt(leaveTypeId),
      balance
    });
  }
  return res.json({ success: true, balances });
});

// POST /hcm/simulate/anniversary -> simulates a work anniversary bonus
// Expected body: { employeeId, daysToAdd }
app.post('/hcm/simulate/anniversary', (req: Request, res: Response) => {
  const { employeeId, daysToAdd } = req.body;
  
  if (!employeeId || !daysToAdd) {
    return res.status(400).json({ success: false, message: 'Missing employeeId or daysToAdd' });
  }

  let updated = 0;
  // Add days to all vacation (assume leaveTypeId = 1 is vacation)
  for (const [key, balance] of db.entries()) {
    const [eId, lId, lTypeId] = key.split('_');
    if (eId === String(employeeId) && lTypeId === '1') {
      db.set(key, balance + daysToAdd);
      updated++;
    }
  }

  if (updated === 0) {
    return res.status(404).json({ success: false, message: 'No vacation records found for employee' });
  }

  return res.json({ success: true, message: `Added ${daysToAdd} days to employee ${employeeId}'s vacation balance` });
});

app.listen(PORT, () => {
  console.log(`Mock HCM Server running on http://localhost:${PORT}`);
});
