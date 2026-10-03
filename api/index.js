/**
 * Vercel Serverless API Handler
 * Mirrors C++ backend logic (FEFO, dynamic threshold, moving average, alerts)
 * for live cloud deployment on Vercel.
 */

const fs = require('fs');
const path = require('path');

// Helper: Today's date string YYYY-MM-DD
function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate days between two YYYY-MM-DD strings: d1 - d2
function daysDiff(d1Str, d2Str) {
  const d1 = new Date(d1Str + 'T00:00:00Z');
  const d2 = new Date(d2Str + 'T00:00:00Z');
  return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}

// Alert level from days left
function getExpiryLevel(daysLeft) {
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= 30) return 'Critical';
  if (daysLeft <= 60) return 'Warning';
  if (daysLeft <= 90) return 'Watch';
  return 'Safe';
}

function getExpirySeverity(level) {
  if (level === 'Expired') return 5;
  if (level === 'Critical') return 4;
  if (level === 'Warning') return 3;
  return 2;
}

// In-Memory Database (seeded from data files)
let dbInitialized = false;
let medicines = [];
let usageLog = [];
let bills = [];

function initDB() {
  if (dbInitialized) return;
  dbInitialized = true;

  try {
    const dataDir = path.join(process.cwd(), 'data');

    // 1. Load inventory.dat
    const invPath = path.join(dataDir, 'inventory.dat');
    if (fs.existsSync(invPath)) {
      const lines = fs.readFileSync(invPath, 'utf8').split('\n');
      for (let raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const f = line.split(',');
        if (f[0] === 'M' && f.length >= 6) {
          medicines.push({
            id: f[1],
            name: f[2],
            category: f[3],
            price: parseFloat(f[4]),
            minLevel: parseInt(f[5], 10),
            batches: []
          });
        } else if (f[0] === 'B' && f.length >= 5) {
          const med = medicines.find(m => m.id === f[1]);
          if (med) {
            med.batches.push({
              batchNo: f[2],
              quantity: parseInt(f[3], 10),
              expiry: f[4]
            });
          }
        }
      }
    }

    // 2. Load usage_log.txt
    const usagePath = path.join(dataDir, 'usage_log.txt');
    if (fs.existsSync(usagePath)) {
      const lines = fs.readFileSync(usagePath, 'utf8').split('\n');
      for (let raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        const f = line.split(',');
        if (f.length >= 3) {
          usageLog.push({
            date: f[0],
            medicineId: f[1],
            quantity: parseInt(f[2], 10)
          });
        }
      }
    }

    // 3. Load bills.dat
    const billsPath = path.join(dataDir, 'bills.dat');
    if (fs.existsSync(billsPath)) {
      const lines = fs.readFileSync(billsPath, 'utf8').split('\n');
      let currentBill = null;
      for (let raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        const f = line.split('|');
        if (f[0] === 'BILL' && f.length >= 5) {
          currentBill = {
            id: f[1],
            date: f[2],
            buyer: f[3],
            total: parseFloat(f[4]),
            items: []
          };
        } else if (f[0] === 'ITEM' && f.length >= 5 && currentBill) {
          currentBill.items.push({
            medicine: f[1],
            batch: f[2],
            quantity: parseInt(f[3], 10),
            price: parseFloat(f[4]),
            total: parseInt(f[3], 10) * parseFloat(f[4])
          });
        } else if (f[0] === 'END' && currentBill) {
          bills.push(currentBill);
          currentBill = null;
        }
      }
    }
  } catch (err) {
    console.error('Error initializing data in serverless environment:', err);
  }

  // Fallback seed if files not found
  if (medicines.length === 0) {
    medicines = [
      {
        id: 'M001', name: 'Paracetamol', category: 'E', price: 25.0, minLevel: 20,
        batches: [
          { batchNo: 'P101', quantity: 20, expiry: '2026-10-20' },
          { batchNo: 'P102', quantity: 100, expiry: '2027-06-30' }
        ]
      },
      {
        id: 'M002', name: 'Amoxicillin', category: 'V', price: 80.0, minLevel: 15,
        batches: [
          { batchNo: 'A200', quantity: 10, expiry: '2026-09-15' },
          { batchNo: 'A201', quantity: 39, expiry: '2027-03-31' }
        ]
      },
      {
        id: 'M003', name: 'Cetirizine', category: 'D', price: 45.0, minLevel: 10,
        batches: [{ batchNo: 'C301', quantity: 5, expiry: '2026-12-01' }]
      }
    ];
  }
}

// Logic implementations matching C++ ThresholdEngine
function vedFactor(category) {
  if (category === 'V') return 1.5;
  if (category === 'E') return 1.2;
  return 1.0;
}

function avgDailyUsage(medId, todayStr, windowDays = 7) {
  let totalSold = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(todayStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayRecords = usageLog.filter(u => u.medicineId === medId && u.date === dayStr);
    for (let r of dayRecords) totalSold += r.quantity;
  }
  return Number((totalSold / windowDays).toFixed(2));
}

function reorderThreshold(med, todayStr, leadTimeDays = 7) {
  const avg = avgDailyUsage(med.id, todayStr, 7);
  const dynamic = avg * leadTimeDays * vedFactor(med.category);
  return Math.max(med.minLevel, Math.ceil(dynamic));
}

function validQty(med, todayStr) {
  return med.batches
    .filter(b => daysDiff(b.expiry, todayStr) >= 0)
    .reduce((sum, b) => sum + b.quantity, 0);
}

function totalQty(med) {
  return med.batches.reduce((sum, b) => sum + b.quantity, 0);
}

function atRiskQty(med, todayStr) {
  const avg = avgDailyUsage(med.id, todayStr);
  const sorted = [...med.batches].sort((a, b) => a.expiry.localeCompare(b.expiry));
  let before = 0;
  let atRisk = 0;
  for (let b of sorted) {
    const daysLeft = daysDiff(b.expiry, todayStr);
    if (daysLeft < 0 || b.quantity === 0) continue;
    const canSell = Math.max(0, avg * daysLeft - before);
    atRisk += Math.max(0, b.quantity - canSell);
    before += b.quantity;
  }
  return Math.ceil(atRisk);
}

function sortBatchesFEFO(med) {
  med.batches.sort((a, b) => a.expiry.localeCompare(b.expiry));
}

// Generate alerts list
function generateAlerts(todayStr) {
  const list = [];
  for (let m of medicines) {
    for (let b of m.batches) {
      if (b.quantity === 0) continue;
      const d = daysDiff(b.expiry, todayStr);
      const level = getExpiryLevel(d);
      if (level !== 'Safe') {
        let msg = `${m.name} (batch ${b.batchNo}, qty ${b.quantity}) `;
        if (d < 0) msg += `expired ${Math.abs(d)} day(s) ago`;
        else if (d === 0) msg += 'expires today';
        else msg += `expires in ${d} day(s)`;

        list.push({
          type: 'Expiry',
          level,
          medicine: m.name,
          batch: b.batchNo,
          message: msg,
          severity: getExpirySeverity(level)
        });
      }
    }

    const usable = validQty(m, todayStr);
    const th = reorderThreshold(m, todayStr);
    if (usable < th) {
      list.push({
        type: 'LowStock',
        level: 'Low Stock',
        medicine: m.name,
        batch: '',
        message: `${m.name} has only ${usable} usable unit(s); reorder threshold is ${th}`,
        severity: 3
      });
    }
  }

  list.sort((a, b) => b.severity - a.severity);
  return list;
}

// Request parser
function parseRequestBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      const params = new URLSearchParams(req.body);
      const obj = {};
      for (let [k, v] of params.entries()) obj[k] = v;
      return obj;
    }
  }
  return {};
}

module.exports = async (req, res) => {
  initDB();
  const todayStr = getTodayStr();

  // Normalize route url
  let url = req.url || '/';
  const qIdx = url.indexOf('?');
  const pathOnly = qIdx !== -1 ? url.slice(0, qIdx) : url;
  const searchParams = new URLSearchParams(qIdx !== -1 ? url.slice(qIdx + 1) : '');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 1. GET /api/health
  if (pathOnly === '/api/health') {
    return res.json({ success: true, message: 'Medical Inventory backend running on Vercel' });
  }

  // 2. GET /api/dashboard
  if (pathOnly === '/api/dashboard') {
    let batches = 0, expired = 0, near = 0, low = 0, units = 0;
    for (let m of medicines) {
      units += totalQty(m);
      for (let b of m.batches) {
        batches++;
        const d = daysDiff(b.expiry, todayStr);
        if (b.quantity > 0 && d < 0) expired++;
        else if (b.quantity > 0 && d <= 90) near++;
      }
      if (validQty(m, todayStr) < reorderThreshold(m, todayStr)) low++;
    }

    let todaySales = 0;
    for (let b of bills) {
      if (b.date === todayStr) todaySales += b.total;
    }

    const alerts = generateAlerts(todayStr);

    return res.json({
      totalMedicines: medicines.length,
      totalBatches: batches,
      totalUnits: units,
      expired,
      nearExpiry: near,
      lowStock: low,
      totalBills: bills.length,
      todaySales,
      today: todayStr,
      alertCount: alerts.length
    });
  }

  // 3. GET /api/medicines
  if (pathOnly === '/api/medicines' && req.method === 'GET') {
    const list = medicines.map(m => {
      sortBatchesFEFO(m);
      return {
        id: m.id,
        name: m.name,
        category: m.category,
        price: m.price,
        minLevel: m.minLevel,
        totalQty: totalQty(m),
        usableQty: validQty(m, todayStr),
        reorderThreshold: reorderThreshold(m, todayStr),
        avgDailyUsage: avgDailyUsage(m.id, todayStr),
        atRiskQty: atRiskQty(m, todayStr),
        batches: m.batches.map(b => {
          const d = daysDiff(b.expiry, todayStr);
          return {
            batchNo: b.batchNo,
            quantity: b.quantity,
            expiry: b.expiry,
            daysLeft: d,
            status: getExpiryLevel(d)
          };
        })
      };
    });
    return res.json(list);
  }

  // 4. POST /api/medicines
  if (pathOnly === '/api/medicines' && req.method === 'POST') {
    const body = parseRequestBody(req);
    const name = (body.name || '').trim();
    const category = (body.category || 'D').toUpperCase().charAt(0);
    const price = parseFloat(body.price || 0);
    const minLevel = parseInt(body.minLevel || 10, 10);
    const batchNo = (body.batchNo || '').trim();
    const quantity = parseInt(body.quantity || 0, 10);
    const expiry = (body.expiry || '').trim();

    if (!name || !batchNo || !expiry) {
      return res.status(400).json({ success: false, error: 'Missing required medicine fields' });
    }

    let existing = medicines.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      const b = existing.batches.find(b => b.batchNo.toLowerCase() === batchNo.toLowerCase());
      if (b) {
        b.quantity += quantity;
      } else {
        existing.batches.push({ batchNo, quantity, expiry });
      }
      existing.price = price;
      existing.minLevel = minLevel;
      sortBatchesFEFO(existing);
      return res.json({ success: true, message: `Batch ${batchNo} added to existing medicine ${existing.name}` });
    }

    const maxId = medicines.reduce((max, m) => {
      const num = parseInt(m.id.replace(/\D/g, ''), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const newId = `M${String(maxId + 1).padStart(3, '0')}`;

    const newMed = {
      id: newId,
      name,
      category,
      price,
      minLevel,
      batches: [{ batchNo, quantity, expiry }]
    };
    medicines.push(newMed);
    return res.json({ success: true, message: `Medicine added successfully (${newId})` });
  }

  // 5. POST /api/medicines/quantity
  if (pathOnly === '/api/medicines/quantity' && req.method === 'POST') {
    const body = parseRequestBody(req);
    const key = (body.medicine || '').toLowerCase().trim();
    const batchNo = (body.batchNo || '').toLowerCase().trim();
    const quantity = parseInt(body.quantity, 10);

    const med = medicines.find(m => m.id.toLowerCase() === key || m.name.toLowerCase() === key);
    if (!med) return res.status(404).json({ success: false, error: 'Medicine not found' });
    const b = med.batches.find(b => b.batchNo.toLowerCase() === batchNo);
    if (!b) return res.status(404).json({ success: false, error: 'Batch not found' });

    b.quantity = Math.max(0, quantity);
    return res.json({ success: true, message: 'Quantity updated' });
  }

  // 6. POST /api/medicines/expiry
  if (pathOnly === '/api/medicines/expiry' && req.method === 'POST') {
    const body = parseRequestBody(req);
    const key = (body.medicine || '').toLowerCase().trim();
    const batchNo = (body.batchNo || '').toLowerCase().trim();
    const expiry = (body.expiry || '').trim();

    const med = medicines.find(m => m.id.toLowerCase() === key || m.name.toLowerCase() === key);
    if (!med) return res.status(404).json({ success: false, error: 'Medicine not found' });
    const b = med.batches.find(b => b.batchNo.toLowerCase() === batchNo);
    if (!b) return res.status(404).json({ success: false, error: 'Batch not found' });

    b.expiry = expiry;
    sortBatchesFEFO(med);
    return res.json({ success: true, message: 'Expiry updated' });
  }

  // 7. POST /api/medicines/remove-expired
  if (pathOnly === '/api/medicines/remove-expired' && req.method === 'POST') {
    let removed = 0;
    for (let m of medicines) {
      const before = m.batches.length;
      m.batches = m.batches.filter(b => daysDiff(b.expiry, todayStr) >= 0);
      removed += before - m.batches.length;
    }
    return res.json({ success: true, message: `${removed} expired batch(es) removed` });
  }

  // 8. GET /api/alerts
  if (pathOnly === '/api/alerts') {
    return res.json(generateAlerts(todayStr));
  }

  // 9. GET /api/reports/inventory
  if (pathOnly === '/api/reports/inventory') {
    const rows = [];
    for (let m of medicines) {
      for (let b of m.batches) {
        const d = daysDiff(b.expiry, todayStr);
        rows.push({
          medicine: m.name,
          batchNo: b.batchNo,
          quantity: b.quantity,
          expiry: b.expiry,
          daysLeft: d,
          status: getExpiryLevel(d),
          value: m.price * b.quantity
        });
      }
    }
    return res.json(rows);
  }

  // 10. GET /api/reports/expired
  if (pathOnly === '/api/reports/expired') {
    const rows = [];
    for (let m of medicines) {
      for (let b of m.batches) {
        const d = daysDiff(b.expiry, todayStr);
        if (d < 0 && b.quantity > 0) {
          rows.push({
            medicine: m.name,
            batchNo: b.batchNo,
            quantity: b.quantity,
            expiry: b.expiry,
            daysPast: Math.abs(d),
            status: 'Expired',
            value: m.price * b.quantity
          });
        }
      }
    }
    return res.json(rows);
  }

  // 11. GET /api/reports/near-expiry
  if (pathOnly === '/api/reports/near-expiry') {
    const days = parseInt(searchParams.get('days') || '90', 10);
    const rows = [];
    for (let m of medicines) {
      for (let b of m.batches) {
        const d = daysDiff(b.expiry, todayStr);
        if (d >= 0 && d <= days && b.quantity > 0) {
          rows.push({
            medicine: m.name,
            batchNo: b.batchNo,
            quantity: b.quantity,
            expiry: b.expiry,
            daysLeft: d,
            status: getExpiryLevel(d),
            value: m.price * b.quantity
          });
        }
      }
    }
    return res.json(rows);
  }

  // 12. GET /api/reports/low-stock
  if (pathOnly === '/api/reports/low-stock') {
    const rows = [];
    for (let m of medicines) {
      const usable = validQty(m, todayStr);
      const th = reorderThreshold(m, todayStr);
      if (usable < th) {
        rows.push({
          medicine: m.name,
          category: m.category,
          usableQty: usable,
          reorderThreshold: th,
          suggestedOrder: Math.max(0, 2 * th - usable)
        });
      }
    }
    return res.json(rows);
  }

  // 13. POST /api/bills
  if (pathOnly === '/api/bills' && req.method === 'POST') {
    const body = parseRequestBody(req);
    const buyer = (body.buyer || 'Walk-in').trim();
    let rawItems = body.items || '';
    let parsedItems = [];

    if (Array.isArray(rawItems)) {
      parsedItems = rawItems;
    } else if (typeof rawItems === 'string') {
      const parts = rawItems.split(',');
      for (let p of parts) {
        if (!p.trim()) continue;
        const lastColon = p.lastIndexOf(':');
        if (lastColon === -1) continue;
        const medName = p.slice(0, lastColon).trim();
        const qty = parseInt(p.slice(lastColon + 1), 10);
        parsedItems.push({ name: medName, quantity: qty });
      }
    }

    if (parsedItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Bill needs at least one item' });
    }

    // Allocate batches via FEFO
    const billItems = [];
    let grandTotal = 0;

    for (let item of parsedItems) {
      const med = medicines.find(m => m.id.toLowerCase() === item.name.toLowerCase() || m.name.toLowerCase() === item.name.toLowerCase());
      if (!med) {
        return res.status(404).json({ success: false, error: `Medicine not found: ${item.name}` });
      }
      const usable = validQty(med, todayStr);
      if (usable < item.quantity) {
        return res.status(409).json({
          success: false,
          error: `${med.name}: requested ${item.quantity}, only ${usable} usable (non-expired) in stock`
        });
      }

      sortBatchesFEFO(med);
      let need = item.quantity;
      for (let b of med.batches) {
        if (need === 0) break;
        if (daysDiff(b.expiry, todayStr) < 0 || b.quantity === 0) continue;
        const take = Math.min(need, b.quantity);
        b.quantity -= take;
        need -= take;
        const lineTotal = take * med.price;
        grandTotal += lineTotal;
        billItems.push({
          medicine: med.name,
          batch: b.batchNo,
          quantity: take,
          price: med.price,
          total: lineTotal
        });
      }

      // Record in usage log
      usageLog.push({ date: todayStr, medicineId: med.id, quantity: item.quantity });
    }

    const nextBillNum = bills.length + 1;
    const billId = `B${String(nextBillNum).padStart(3, '0')}`;
    const newBill = {
      id: billId,
      date: todayStr,
      buyer,
      total: grandTotal,
      items: billItems
    };
    bills.push(newBill);

    return res.json({ success: true, bill: newBill });
  }

  // 14. GET /api/bills
  if (pathOnly === '/api/bills' && req.method === 'GET') {
    return res.json([...bills].reverse());
  }

  // 15. GET /api/bills/:id/print
  const printMatch = pathOnly.match(/^\/api\/bills\/([A-Za-z0-9]+)\/print$/);
  if (printMatch) {
    const id = printMatch[1].toLowerCase();
    const b = bills.find(x => x.id.toLowerCase() === id);
    if (!b) return res.status(404).send('Bill not found: ' + printMatch[1]);

    const divider = '--------------------------------------------\n';
    let text = 'MEDICAL INVENTORY MANAGEMENT\n' + divider;
    text += `Bill No: ${b.id}\nDate: ${b.date}\n\nBuyer: ${b.buyer}\n\n`;
    text += 'Medicine          Batch   Qty   Amount\n' + divider;
    for (let it of b.items) {
      const medName = it.medicine.padEnd(17, ' ').slice(0, 17);
      const batch = it.batch.padEnd(7, ' ').slice(0, 7);
      const qty = String(it.quantity).padEnd(5, ' ');
      const amt = 'Rs.' + it.total.toFixed(2);
      text += `${medName} ${batch} ${qty} ${amt}\n`;
    }
    text += divider + `TOTAL: Rs.${b.total.toFixed(2)}\n` + divider + '\n        Thank You\n';

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(text);
  }

  // 16. GET /api/bills/:id
  const billMatch = pathOnly.match(/^\/api\/bills\/([A-Za-z0-9]+)$/);
  if (billMatch) {
    const id = billMatch[1].toLowerCase();
    const b = bills.find(x => x.id.toLowerCase() === id);
    if (!b) return res.status(404).json({ success: false, error: 'Bill not found' });
    return res.json(b);
  }

  return res.status(404).json({ success: false, error: 'API route not found' });
};
