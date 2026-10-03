# Medical Inventory Management - C++ OOP Backend

C++ = brain (saari logic + file storage), Web = face (HTML/CSS/JS).
Browser -> HTTP/JSON -> C++ server -> data/ files.

## Run
Linux / Mac:   `make` then `./server`        (port 8080; custom port: `./server 9000`)
Windows:       MinGW/MSYS2 g++ install karo, `build.bat` chalao, phir `server.exe`
Server hamesha project ke root se chalana hai (jahan `data/` aur `web/` folders hain).
`web/` folder automatically `http://localhost:8080/` par serve hota hai (CORS bhi on hai).

Demo ke liye date fix karni ho: `MIS_TODAY=2026-10-03 ./server`  (Windows: `set MIS_TODAY=2026-10-03`)

## API (POST body = form-data ya flat JSON, dono chalte hain)
| Method | URL | Fields / kaam |
|---|---|---|
| GET | /api/dashboard | totalMedicines, totalBatches, totalUnits, expired, nearExpiry, lowStock, totalBills, todaySales, alertCount |
| GET | /api/medicines | medicines + batches + status + reorderThreshold + avgDailyUsage + atRiskQty |
| POST | /api/medicines | name, category (V/E/D), price, minLevel, batchNo, quantity, expiry (YYYY-MM-DD). Medicine exist kare to naya batch add hota hai |
| POST | /api/medicines/quantity | medicine (id ya name), batchNo, quantity |
| POST | /api/medicines/expiry | medicine, batchNo, expiry |
| POST | /api/medicines/remove-expired | expired batches delete |
| GET | /api/alerts | Expired / Critical / Warning / Watch / Low Stock (severity order) |
| GET | /api/reports/inventory, /expired, /near-expiry?days=90, /low-stock | report tables |
| POST | /api/bills | buyer, items = `Paracetamol:2,Amoxicillin:1` |
| GET | /api/bills | bill history (newest first) |
| GET | /api/bills/B001 | ek bill ka JSON |
| GET | /api/bills/B001/print | printable text bill (`<pre>` mein dikha ke window.print()) |

Success: `{"success":true,"message":...}`  Error: `{"success":false,"error":"..."}` with HTTP 400 / 404 / 409 / 500.
Alert levels: Expired (<0 din), Critical (<=30), Warning (<=60), Watch (<=90).

JS example:
```js
const body = new URLSearchParams({ buyer: 'Aman', items: 'Paracetamol:2,Amoxicillin:1' });
const res = await fetch('/api/bills', { method: 'POST', body });
const data = await res.json();   // data.success, data.bill
```

## Data files (data/)
- inventory.dat  - `M,id,name,cat,price,minLevel` aur `B,medId,batchNo,qty,expiry` lines
- usage_log.txt  - `date,medId,qty` (har bill pe append; moving average isi se)
- alerts.log     - alerts ki history
- bills.dat      - `BILL|..`, `ITEM|..`, `END`
Fresh start ke liye inventory.dat / usage_log.txt khali kar do (files na ho to bhi chalega).

## Classes
Date, Batch, Medicine (Medicine HAS-MANY Batch) | InventoryManager | Alert (abstract) -> ExpiryAlert, LowStockAlert | AlertService |
ThresholdEngine + MovingAverage<T> | ReportService | BillItem, Bill, BillingService | Storage (abstract) -> FileStorage |
InventoryException -> Validation / NotFound / InsufficientStock / Storage | main.cpp = HTTP routes

## Viva: syllabus topic -> code mapping
| Syllabus topic | Kahan |
|---|---|
| Classes, objects, data hiding, encapsulation | Medicine, Batch, Date (private data + getters/setters) |
| Constructors (default, parameterised, overloading), destructors | Batch(), Batch(no,qty,exp), Medicine(), ~Medicine() |
| `this` pointer, returning reference | Batch::setQuantity, Medicine::setPrice().setMinLevel() chaining |
| Array of objects | `vector<Medicine>` in InventoryManager |
| Static data members & methods | Bill::counter, Bill::generateId(), Alert::created, Date::today() |
| Friend function | `operator<<` for Medicine and Bill |
| Operator overloading | Date::operator-, <, ==; Batch::operator< (FEFO sort); Bill::operator+=; operator<< |
| Inheritance, abstract class, virtual, run-time polymorphism | Alert -> ExpiryAlert/LowStockAlert; Storage -> FileStorage |
| Composition / reuse | Medicine contains Batches; BillingService uses InventoryManager |
| File handling (fstream, append, error handling) | FileStorage.cpp |
| Exception handling (custom, multiple catch, rethrow) | Exceptions.h, BillingService::createBill (catch(...) rollback + throw), main.cpp route() |
| Templates / generics | MovingAverage<T> |
| SOLID | S: har class ek kaam. O: naya Alert type add karo, AlertService same. L: Alert* kisi bhi subclass se. I: chhota Storage interface. D: services `Storage&` par depend karti hain, FileStorage par nahi |
