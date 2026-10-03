/**
 * Medical Inventory Management System - Frontend JavaScript
 *
 * Architecture:
 * - Single Page Application (SPA) driven by vanilla JavaScript.
 * - Communicates with the C++ backend HTTP server over relative REST endpoints.
 * - Adheres to college OOP project viva principles: cleanly modularized,
 *   informative comments mapping JS features to C++ classes.
 */

// =============================================================================
// 1. GLOBAL STATE & HELPERS
// =============================================================================

// In-memory cache of current medicines for dropdowns, search & validation
let currentMedicinesList = [];

// Cart state for the draft bill currently being assembled in JS
let draftBillItems = [];

// Active expanded row IDs in the inventory table
const expandedMedicineIds = new Set();

// Active level filter for alerts tab
let currentAlertFilter = 'ALL';

// Active sub-tab for reports
let currentReportSubTab = 'inventory';

// Cache for all alerts to enable instant client-side level filtering
let cachedAlerts = [];

/**
 * Formats an ISO date string (YYYY-MM-DD) into display format (DD/MM/YYYY).
 * Required by viva specification: API sends YYYY-MM-DD, UI presents DD/MM/YYYY.
 */
function formatDate(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return '-';
  const parts = isoStr.trim().split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return isoStr;
}

/**
 * Formats a numeric value into Indian Rupee currency (₹).
 */
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toFixed(2);
}

/**
 * Returns HTML badge string for a given alert/stock status.
 * Status colors per project specs:
 * Expired = Red, Critical = Orange, Warning = Amber, Watch = Blue, Safe = Green, Low Stock = Purple.
 */
function getStatusBadge(status) {
  if (!status) return '<span class="badge">-</span>';
  const s = status.trim();
  const lower = s.toLowerCase().replace(/\s+/g, '-');
  return `<span class="badge badge-${lower}">${escapeHtml(s)}</span>`;
}

/**
 * Returns HTML badge for VED category (Vital, Essential, Desirable).
 */
function getCategoryBadge(cat) {
  const c = (cat || 'D').toUpperCase();
  let label = 'D - Desirable';
  let badgeClass = 'badge-ved-d';
  if (c === 'V') {
    label = 'V - Vital';
    badgeClass = 'badge-ved-v';
  } else if (c === 'E') {
    label = 'E - Essential';
    badgeClass = 'badge-ved-e';
  }
  return `<span class="badge ${badgeClass}">${label}</span>`;
}

/**
 * Safely escapes strings to prevent XSS.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Updates UI server connection indicator & warning banner.
 */
function updateServerStatus(isOnline) {
  const badge = document.getElementById('header-status-badge');
  const text = document.getElementById('header-status-text');
  const banner = document.getElementById('server-offline-banner');

  if (isOnline) {
    badge.className = 'status-indicator online';
    text.textContent = 'Connected';
    banner.classList.remove('visible');
  } else {
    badge.className = 'status-indicator offline';
    text.textContent = 'Disconnected';
    banner.classList.add('visible');
  }
}

/**
 * Displays a non-intrusive toast notification (replaces alert popups).
 * @param {string} message - Message text to display
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '<svg class="icon" width="18" height="18" aria-hidden="true"><use href="assets/icons.svg#check-circle-2"></use></svg>' : type === 'error' ? '<svg class="icon" width="18" height="18" aria-hidden="true"><use href="assets/icons.svg#x-circle"></use></svg>' : '<svg class="icon" width="18" height="18" aria-hidden="true"><use href="assets/icons.svg#info"></use></svg>';
  const title = type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close notification"><svg class="icon" width="14" height="14" aria-hidden="true"><use href="assets/icons.svg#x"></use></svg></button>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 250);
    }
  }, 4000);
}

// =============================================================================
// 2. CENTRAL API HELPER FUNCTION
// =============================================================================

/**
 * Central API helper function adhering to project requirements:
 * - Uses relative URLs (e.g., '/api/dashboard').
 * - Form-encodes POST body via URLSearchParams.
 * - Parses JSON and reads res.json() even on non-200 status codes.
 * - Throws descriptive Error on { success: false } or network error.
 *
 * @param {string} method - 'GET' or 'POST'
 * @param {string} url - Relative endpoint
 * @param {Object} [params=null] - Query params (GET) or form body parameters (POST)
 */
async function api(method, url, params = null) {
  const options = {
    method: method.toUpperCase(),
    headers: {}
  };

  let targetUrl = url;

  if (options.method === 'GET' && params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) targetUrl += (targetUrl.includes('?') ? '&' : '?') + qs;
  } else if (options.method === 'POST') {
    // Backend expects form-encoded body (URLSearchParams)
    const urlParams = new URLSearchParams();
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          urlParams.append(key, String(val));
        }
      }
    }
    options.body = urlParams;
  }

  let res;
  try {
    res = await fetch(targetUrl, options);
  } catch (netErr) {
    updateServerStatus(false);
    throw new Error('C++ backend server is unreachable. Please verify server is running on http://localhost:8080.');
  }

  // Network connection successful
  updateServerStatus(true);

  // Parse response based on Content-Type
  const contentType = res.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Server returned an unparseable JSON response');
    }
  } else {
    // Non-JSON response (e.g. plain text for /api/bills/:id/print, or HTML 404 page from static file servers)
    const textData = await res.text();
    if (!res.ok) {
      updateServerStatus(false);
      if (res.status === 404) {
        throw new Error('Backend API endpoint not found (404). Please start the C++ server (server.exe) so API routes are handled.');
      }
      if (contentType.includes('text/html')) {
        throw new Error(`Server returned HTTP ${res.status}. Please check that the C++ backend is running on port 8080.`);
      }
      throw new Error(textData.length > 150 ? `Server error (${res.status})` : textData);
    }
    return textData;
  }

  // Check for HTTP errors or explicit C++ backend failure responses
  if (!res.ok || (data && data.success === false)) {
    const errorMessage = (data && data.error) ? data.error : `Request failed with HTTP status ${res.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

// =============================================================================
// 3. TAB NAVIGATION
// =============================================================================

/**
 * Switches the active screen among the 4 tabs without any page reload.
 * Tabs: 'dashboard' | 'inventory' | 'alerts-reports' | 'billing'
 */
function switchTab(tabId) {
  // Update nav buttons
  document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Segregate screens: hide all other panes completely
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active', 'tab-anim-in');
    pane.style.display = 'none';
  });

  // Show only the selected screen
  const activePane = document.getElementById(`pane-${tabId}`);
  if (activePane) {
    activePane.classList.add('active');
    activePane.style.display = 'block';
  }

  // Refresh target tab's data dynamically
  if (tabId === 'dashboard') {
    loadDashboard();
  } else if (tabId === 'inventory') {
    loadInventory();
  } else if (tabId === 'alerts-reports') {
    loadAlerts();
    refreshCurrentReport();
  } else if (tabId === 'billing') {
    loadBillingMedicines();
    loadBillHistory();
  }
}

// =============================================================================
// 4. SCREEN 1: DASHBOARD
// =============================================================================

/**
 * Fetches dashboard KPIs from the C++ backend.
 * C++ mapping: ReportService::dashboard()
 */
async function loadDashboard() {
  try {
    const dashData = await api('GET', '/api/dashboard');

    // Update KPI Card Values
    document.getElementById('kpi-medicines').textContent = dashData.totalMedicines ?? 0;
    document.getElementById('kpi-batches').textContent = dashData.totalBatches ?? 0;
    document.getElementById('kpi-units').textContent = dashData.totalUnits ?? 0;
    document.getElementById('kpi-expired').textContent = dashData.expired ?? 0;
    document.getElementById('kpi-near-expiry').textContent = dashData.nearExpiry ?? 0;
    document.getElementById('kpi-low-stock').textContent = dashData.lowStock ?? 0;
    document.getElementById('kpi-bills').textContent = dashData.totalBills ?? 0;
    document.getElementById('kpi-today-sales').textContent = formatCurrency(dashData.todaySales ?? 0);
    document.getElementById('kpi-alert-count').textContent = dashData.alertCount ?? 0;

    // Display System Date from Backend
    const formattedToday = formatDate(dashData.today);
    document.getElementById('kpi-today').textContent = formattedToday;
    document.getElementById('header-today-date').textContent = formattedToday;

    // Render Top 5 Alerts if container exists
    const container = document.getElementById('dashboard-alerts-list');
    if (container) {
      const alertsData = await api('GET', '/api/alerts');
      renderDashboardAlerts(alertsData.slice(0, 5));
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Renders the top priority alerts inside the dashboard card.
 */
function renderDashboardAlerts(alerts) {
  const container = document.getElementById('dashboard-alerts-list');
  if (!alerts || alerts.length === 0) {
    container.innerHTML = `
      <div class="table-empty-state" style="padding: 1.5rem; color: var(--status-safe-text); display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
        <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#check-circle-2"></use></svg> No urgent alerts found. All inventory batches and stock levels are healthy!
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div class="alert-item-card">
      <div class="alert-item-left">
        ${getStatusBadge(a.level)}
        <div>
          <div class="alert-item-msg">${escapeHtml(a.message)}</div>
          <div class="alert-item-meta">
            Medicine: <strong>${escapeHtml(a.medicine)}</strong>
            ${a.batch ? ` &bull; Batch: <strong>${escapeHtml(a.batch)}</strong>` : ''}
            &bull; Type: <em>${escapeHtml(a.type)}</em>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// =============================================================================
// 5. SCREEN 2: INVENTORY
// =============================================================================

/**
 * Fetches all medicines along with their batches from the C++ backend.
 * C++ mapping: ReportService::medicines()
 */
async function loadInventory() {
  const tbody = document.getElementById('medicines-table-body');
  try {
    const list = await api('GET', '/api/medicines');
    currentMedicinesList = Array.isArray(list) ? list : [];
    filterMedicinesTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty-state" style="color: var(--status-expired-text);">Failed to load inventory: ${escapeHtml(err.message)}</td></tr>`;
    showToast(err.message, 'error');
  }
}

/**
 * Filters the medicines table based on search input and VED category filter.
 */
function filterMedicinesTable() {
  const searchInput = document.getElementById('inventory-search-input');
  const catSelect = document.getElementById('inventory-cat-filter');
  const term = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedCat = catSelect ? catSelect.value : 'ALL';

  const filtered = currentMedicinesList.filter(m => {
    const matchCat = (selectedCat === 'ALL') || (m.category === selectedCat);
    const matchTerm = !term ||
      (m.id && m.id.toLowerCase().includes(term)) ||
      (m.name && m.name.toLowerCase().includes(term)) ||
      (m.category && m.category.toLowerCase().includes(term));
    return matchCat && matchTerm;
  });

  renderMedicinesTable(filtered);
}

/**
 * Renders the table of medicines and their expandable batch sub-tables.
 */
function renderMedicinesTable(medicines) {
  const tbody = document.getElementById('medicines-table-body');
  if (!tbody) return;

  if (medicines.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty-state">No medicines match the search/filter criteria.</td></tr>`;
    return;
  }

  let html = '';
  medicines.forEach(m => {
    const isExpanded = expandedMedicineIds.has(m.id);
    const expandIcon = `<svg class="icon icon-chevron ${isExpanded ? 'expanded' : ''}" width="16" height="16" aria-hidden="true"><use href="assets/icons.svg#chevron-right"></use></svg>`;

    html += `
      <tr class="row-expandable" onclick="toggleMedicineBatches('${escapeHtml(m.id)}', event)">
        <td style="text-align: center; color: var(--primary);">${expandIcon}</td>
        <td><code>${escapeHtml(m.id)}</code></td>
        <td><strong>${escapeHtml(m.name)}</strong></td>
        <td>${getCategoryBadge(m.category)}</td>
        <td>${formatCurrency(m.price)}</td>
        <td>${m.totalQty}</td>
        <td><strong style="color: ${m.usableQty < m.reorderThreshold ? 'var(--status-lowstock-text)' : 'inherit'}">${m.usableQty}</strong></td>
        <td>${m.minLevel}</td>
        <td>${m.reorderThreshold}</td>
        <td>${Number(m.avgDailyUsage).toFixed(2)}/day</td>
        <td><span style="color: ${m.atRiskQty > 0 ? 'var(--status-critical-text)' : 'inherit'}">${m.atRiskQty}</span></td>
      </tr>
    `;

    // If expanded, insert batch details row
    if (isExpanded) {
      html += `
        <tr class="expanded-row-container">
          <td colspan="11" class="expanded-row-cell">
            <div class="batch-subtable-wrapper">
              <div class="batch-subtable-title">
                <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#layers"></use></svg> Batches for ${escapeHtml(m.name)} (${escapeHtml(m.id)})
              </div>
              ${renderBatchesSubTable(m)}
            </div>
          </td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = html;
}

/**
 * Renders batch details sub-table with inline Update Quantity and Update Expiry actions.
 */
function renderBatchesSubTable(medicine) {
  const batches = medicine.batches || [];
  if (batches.length === 0) {
    return `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem 0;">No active batches recorded for this medicine.</div>`;
  }

  let rows = batches.map(b => `
    <tr>
      <td><code>${escapeHtml(b.batchNo)}</code></td>
      <td><strong>${b.quantity}</strong> units</td>
      <td>${formatDate(b.expiry)}</td>
      <td>${b.daysLeft < 0 ? `<span style="color:red">${Math.abs(b.daysLeft)}d ago</span>` : `${b.daysLeft} days`}</td>
      <td>${getStatusBadge(b.status)}</td>
      <td style="text-align: right;">
        <button class="btn btn-secondary btn-sm" onclick="openUpdateQtyModal('${escapeHtml(medicine.id)}', '${escapeHtml(medicine.name)}', '${escapeHtml(b.batchNo)}', ${b.quantity})">
          Qty
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openUpdateExpiryModal('${escapeHtml(medicine.id)}', '${escapeHtml(medicine.name)}', '${escapeHtml(b.batchNo)}', '${escapeHtml(b.expiry)}')">
          Expiry
        </button>
      </td>
    </tr>
  `).join('');

  return `
    <table class="batch-table">
      <thead>
        <tr>
          <th>Batch No</th>
          <th>Quantity</th>
          <th>Expiry Date</th>
          <th>Days Left</th>
          <th>Status</th>
          <th style="text-align: right;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Toggles expanding/collapsing a medicine row to reveal batches.
 */
function toggleMedicineBatches(medicineId, event) {
  // Ignore clicks on action buttons inside the row
  if (event && event.target.closest('button')) return;

  if (expandedMedicineIds.has(medicineId)) {
    expandedMedicineIds.delete(medicineId);
  } else {
    expandedMedicineIds.add(medicineId);
  }
  filterMedicinesTable();
}

/**
 * Opens "Add Medicine" modal.
 */
function openAddMedicineModal() {
  const form = document.getElementById('form-add-medicine');
  if (form) form.reset();

  // Set default expiry date to 1 year from today
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const expiryInput = document.getElementById('add-expiry');
  if (expiryInput) {
    expiryInput.value = nextYear.toISOString().split('T')[0];
  }

  openModal('modal-add-medicine');
}

/**
 * Submits new medicine / batch to C++ backend.
 * Route: POST /api/medicines
 */
async function submitAddMedicine(event) {
  event.preventDefault();

  const name = document.getElementById('add-name').value.trim();
  const category = document.getElementById('add-category').value;
  const price = document.getElementById('add-price').value;
  const minLevel = document.getElementById('add-min-level').value;
  const batchNo = document.getElementById('add-batch').value.trim();
  const quantity = document.getElementById('add-qty').value;
  const expiry = document.getElementById('add-expiry').value;

  // Browser-side input validation
  if (!name || !batchNo || !expiry) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }
  if (Number(price) < 0) {
    showToast('Price cannot be negative.', 'error');
    return;
  }
  if (Number(quantity) <= 0) {
    showToast('Quantity must be greater than zero.', 'error');
    return;
  }

  try {
    const res = await api('POST', '/api/medicines', {
      name,
      category,
      price,
      minLevel,
      batchNo,
      quantity,
      expiry
    });

    closeModal('modal-add-medicine');
    showToast(res.message || 'Medicine saved successfully!', 'success');
    await loadInventory();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Opens Update Quantity Modal for a specific batch.
 */
function openUpdateQtyModal(medId, medName, batchNo, currentQty) {
  document.getElementById('edit-qty-med-key').value = medId;
  document.getElementById('edit-qty-med-name').value = `${medName} (${medId})`;
  document.getElementById('edit-qty-batch').value = batchNo;
  document.getElementById('edit-qty-input').value = currentQty;

  openModal('modal-update-qty');
}

/**
 * Submits batch quantity update to backend.
 * Route: POST /api/medicines/quantity
 */
async function submitUpdateQuantity(event) {
  event.preventDefault();

  const medicine = document.getElementById('edit-qty-med-key').value;
  const batchNo = document.getElementById('edit-qty-batch').value;
  const quantity = document.getElementById('edit-qty-input').value;

  if (Number(quantity) < 0) {
    showToast('Quantity cannot be negative.', 'error');
    return;
  }

  try {
    const res = await api('POST', '/api/medicines/quantity', {
      medicine,
      batchNo,
      quantity
    });

    closeModal('modal-update-qty');
    showToast(res.message || 'Batch quantity updated', 'success');
    await loadInventory();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Opens Update Expiry Modal for a specific batch.
 */
function openUpdateExpiryModal(medId, medName, batchNo, currentExpiry) {
  document.getElementById('edit-exp-med-key').value = medId;
  document.getElementById('edit-exp-med-name').value = `${medName} (${medId})`;
  document.getElementById('edit-exp-batch').value = batchNo;
  document.getElementById('edit-exp-date').value = currentExpiry;

  openModal('modal-update-expiry');
}

/**
 * Submits batch expiry update to backend.
 * Route: POST /api/medicines/expiry
 */
async function submitUpdateExpiry(event) {
  event.preventDefault();

  const medicine = document.getElementById('edit-exp-med-key').value;
  const batchNo = document.getElementById('edit-exp-batch').value;
  const expiry = document.getElementById('edit-exp-date').value;

  if (!expiry) {
    showToast('Please select a valid expiry date.', 'error');
    return;
  }

  try {
    const res = await api('POST', '/api/medicines/expiry', {
      medicine,
      batchNo,
      expiry
    });

    closeModal('modal-update-expiry');
    showToast(res.message || 'Batch expiry updated', 'success');
    await loadInventory();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Prompts user with custom confirm dialog to remove all expired batches.
 * Avoids window.confirm() per specification.
 */
function promptRemoveExpired() {
  openConfirmModal(
    'Purge Expired Stock',
    'Are you sure you want to permanently delete all batches whose expiry date has passed? Non-expired stock will remain unaffected.',
    async () => {
      try {
        const res = await api('POST', '/api/medicines/remove-expired');
        showToast(res.message || 'Expired batches removed successfully', 'success');
        await loadInventory();
        loadDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// =============================================================================
// 6. SCREEN 3: ALERTS & REPORTS
// =============================================================================

/**
 * Fetches and displays all stock and expiry alerts with level counters.
 * C++ mapping: AlertService::generate(), ExpiryAlert, LowStockAlert
 */
async function loadAlerts() {
  try {
    const list = await api('GET', '/api/alerts');
    cachedAlerts = Array.isArray(list) ? list : [];

    // Calculate level counts for filter pill badges
    const counts = {
      'ALL': cachedAlerts.length,
      'Expired': 0,
      'Critical': 0,
      'Warning': 0,
      'Watch': 0,
      'Low Stock': 0
    };

    cachedAlerts.forEach(a => {
      if (counts[a.level] !== undefined) counts[a.level]++;
    });

    document.getElementById('alert-cnt-all').textContent = counts['ALL'];
    document.getElementById('alert-cnt-expired').textContent = counts['Expired'];
    document.getElementById('alert-cnt-critical').textContent = counts['Critical'];
    document.getElementById('alert-cnt-warning').textContent = counts['Warning'];
    document.getElementById('alert-cnt-watch').textContent = counts['Watch'];
    document.getElementById('alert-cnt-lowstock').textContent = counts['Low Stock'];

    renderAlertsList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Filters the alerts list by selected level button.
 */
function filterAlerts(level) {
  currentAlertFilter = level;

  // Update active pill button
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-level') === level);
  });

  renderAlertsList();
}

/**
 * Renders the filtered alerts into the alerts list.
 */
function renderAlertsList() {
  const container = document.getElementById('alerts-full-list');
  if (!container) return;

  const filtered = (currentAlertFilter === 'ALL')
    ? cachedAlerts
    : cachedAlerts.filter(a => a.level === currentAlertFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="table-empty-state" style="padding: 1.5rem;">
        No active alerts for level: <strong>${escapeHtml(currentAlertFilter)}</strong>.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => `
    <div class="alert-item-card">
      <div class="alert-item-left">
        ${getStatusBadge(a.level)}
        <div>
          <div class="alert-item-msg">${escapeHtml(a.message)}</div>
          <div class="alert-item-meta">
            Medicine: <strong>${escapeHtml(a.medicine)}</strong>
            ${a.batch ? ` &bull; Batch: <strong>${escapeHtml(a.batch)}</strong>` : ''}
            &bull; Alert Class: <em>${escapeHtml(a.type)}</em>
            &bull; Severity Rank: <code>${a.severity}</code>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Switches between the 4 report sub-tabs:
 * 'inventory' | 'expired' | 'near-expiry' | 'low-stock'
 */
function switchReportSubTab(subTabId) {
  currentReportSubTab = subTabId;

  // Update subnav buttons
  document.querySelectorAll('.report-subtab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`report-subtab-${subTabId === 'inventory' ? 'inv' : subTabId === 'expired' ? 'exp' : subTabId === 'near-expiry' ? 'near' : 'low'}`);
  if (btn) btn.classList.add('active');

  // Show / hide days threshold control for near-expiry
  const daysControl = document.getElementById('near-expiry-control');
  if (daysControl) {
    daysControl.style.display = (subTabId === 'near-expiry') ? 'flex' : 'none';
  }

  refreshCurrentReport();
}

/**
 * Loads data for whichever report sub-tab is currently active.
 */
async function refreshCurrentReport() {
  const heading = document.getElementById('report-heading');
  const subheading = document.getElementById('report-subheading');
  const thead = document.getElementById('report-table-head');
  const tbody = document.getElementById('report-table-body');
  const table = document.getElementById('report-table');

  if (table) table.classList.add('table-refreshing');
  if (!tbody.hasChildNodes() || tbody.children.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state">Loading report data from C++ ReportService...</td></tr>`;
  }

  try {
    if (currentReportSubTab === 'inventory') {
      heading.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#package"></use></svg> Full Inventory Valuation Report';
      subheading.textContent = 'All batches in stock with valuation & expiry timeline';
      thead.innerHTML = `
        <tr>
          <th>Medicine</th>
          <th>Batch No</th>
          <th>Quantity</th>
          <th>Expiry Date</th>
          <th>Days Left</th>
          <th>Status</th>
          <th>Value</th>
        </tr>
      `;
      const data = await api('GET', '/api/reports/inventory');
      renderStandardReportRows(data, tbody);

    } else if (currentReportSubTab === 'expired') {
      heading.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#calendar-x"></use></svg> Expired Stock Audit Report';
      subheading.textContent = 'Batches whose expiry date has passed and require removal';
      thead.innerHTML = `
        <tr>
          <th>Medicine</th>
          <th>Batch No</th>
          <th>Quantity</th>
          <th>Expiry Date</th>
          <th>Days Past</th>
          <th>Status</th>
          <th>Loss Value</th>
        </tr>
      `;
      const data = await api('GET', '/api/reports/expired');
      renderStandardReportRows(data, tbody);

    } else if (currentReportSubTab === 'near-expiry') {
      loadNearExpiryReport();

    } else if (currentReportSubTab === 'low-stock') {
      heading.innerHTML = '<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#trending-down"></use></svg> Low-Stock Reorder Procurement Report';
      subheading.textContent = 'Medicines where usable stock is below dynamic reorder threshold';
      thead.innerHTML = `
        <tr>
          <th>Medicine</th>
          <th>Category</th>
          <th>Usable Stock</th>
          <th>Reorder Threshold</th>
          <th>Suggested Order Qty</th>
        </tr>
      `;
      const data = await api('GET', '/api/reports/low-stock');
      renderLowStockReportRows(data, tbody);
    }
  } catch (err) {
    if (table) table.classList.remove('table-refreshing');
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state" style="color: var(--status-expired-text);">Failed to load report: ${escapeHtml(err.message)}</td></tr>`;
    showToast(err.message, 'error');
  }
}

/**
 * Loads Near-Expiry report with custom days parameter.
 */
async function loadNearExpiryReport() {
  const daysInput = document.getElementById('report-days-input');
  const days = daysInput ? daysInput.value : 90;

  const heading = document.getElementById('report-heading');
  const subheading = document.getElementById('report-subheading');
  const thead = document.getElementById('report-table-head');
  const tbody = document.getElementById('report-table-body');
  const table = document.getElementById('report-table');

  if (table) table.classList.add('table-refreshing');
  if (!tbody.hasChildNodes() || tbody.children.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state">Loading report data from C++ ReportService...</td></tr>`;
  }

  heading.innerHTML = `<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#hourglass"></use></svg> Near-Expiry Report (Next ${days} Days)`;
  subheading.textContent = `Batches expiring within the next ${days} days`;
  thead.innerHTML = `
    <tr>
      <th>Medicine</th>
      <th>Batch No</th>
      <th>Quantity</th>
      <th>Expiry Date</th>
      <th>Days Left</th>
      <th>Status</th>
      <th>Stock Value</th>
    </tr>
  `;

  try {
    const data = await api('GET', '/api/reports/near-expiry', { days });
    renderStandardReportRows(data, tbody);
  } catch (err) {
    if (table) table.classList.remove('table-refreshing');
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state" style="color: var(--status-expired-text);">Failed to load near-expiry report: ${escapeHtml(err.message)}</td></tr>`;
    showToast(err.message, 'error');
  }
}

/**
 * Renders table rows for inventory / expired / near-expiry reports.
 */
function renderStandardReportRows(rows, tbody) {
  const table = document.getElementById('report-table');
  if (table) {
    table.classList.remove('table-refreshing');
    table.classList.remove('table-fade-in');
    void table.offsetWidth;
    table.classList.add('table-fade-in');
  }

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state">No matching records found for this report.</td></tr>`;
    return;
  }

  let totalQty = 0;
  let totalVal = 0;

  let html = rows.map(r => {
    totalQty += Number(r.quantity || 0);
    totalVal += Number(r.value || 0);

    return `
      <tr>
        <td><strong>${escapeHtml(r.medicine)}</strong></td>
        <td><code>${escapeHtml(r.batchNo)}</code></td>
        <td>${r.quantity}</td>
        <td>${formatDate(r.expiry)}</td>
        <td>${r.daysLeft < 0 ? `${Math.abs(r.daysLeft)} days ago` : `${r.daysLeft} days`}</td>
        <td>${getStatusBadge(r.status)}</td>
        <td>${formatCurrency(r.value)}</td>
      </tr>
    `;
  }).join('');

  // Summary Row
  html += `
    <tr style="background: var(--bg-card-alt); font-weight: bold; border-top: 2px solid var(--border-color);">
      <td colspan="2">TOTAL (${rows.length} batches)</td>
      <td>${totalQty}</td>
      <td colspan="3"></td>
      <td style="color: var(--primary);">${formatCurrency(totalVal)}</td>
    </tr>
  `;

  tbody.innerHTML = html;
}

/**
 * Renders table rows for low-stock reorder report.
 */
function renderLowStockReportRows(rows, tbody) {
  const table = document.getElementById('report-table');
  if (table) {
    table.classList.remove('table-refreshing');
    table.classList.remove('table-fade-in');
    void table.offsetWidth;
    table.classList.add('table-fade-in');
  }

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty-state" style="color: var(--status-safe-text);"><svg class="icon" aria-hidden="true"><use href="assets/icons.svg#check-circle-2"></use></svg> All stock levels are sufficient. No medicines require replenishment right now!</td></tr>`;
    return;
  }

  let html = rows.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.medicine)}</strong></td>
      <td>${getCategoryBadge(r.category)}</td>
      <td><span style="color: var(--status-critical-text); font-weight: bold;">${r.usableQty}</span></td>
      <td>${r.reorderThreshold}</td>
      <td><strong style="color: var(--status-watch-text);">${r.suggestedOrder}</strong> units</td>
    </tr>
  `).join('');

  tbody.innerHTML = html;
}

/**
 * Trigger browser print dialog for current report.
 */
function printReport() {
  window.print();
}

// =============================================================================
// 7. SCREEN 4: BILLING & INVOICE HISTORY
// =============================================================================

/**
 * Loads medicines to populate the billing dropdown with real-time usable quantities.
 */
async function loadBillingMedicines() {
  const select = document.getElementById('bill-med-select');
  if (!select) return;

  try {
    const list = await api('GET', '/api/medicines');
    currentMedicinesList = Array.isArray(list) ? list : [];

    select.innerHTML = '<option value="">-- Choose medicine --</option>' +
      currentMedicinesList.map(m => {
        const isOutOfStock = m.usableQty <= 0;
        const text = `${m.name} (Usable: ${m.usableQty} | ${formatCurrency(m.price)})`;
        return `<option value="${escapeHtml(m.name)}" data-price="${m.price}" data-usable="${m.usableQty}" ${isOutOfStock ? 'disabled' : ''}>
          ${escapeHtml(text)}
        </option>`;
      }).join('');
  } catch (err) {
    showToast('Failed to load medicines list for billing: ' + err.message, 'error');
  }
}

/**
 * Adjusts quantity input max limit when a medicine is selected in bill creator.
 */
function onBillMedicineSelected() {
  const select = document.getElementById('bill-med-select');
  const qtyInput = document.getElementById('bill-qty-input');
  if (!select || !qtyInput) return;

  const opt = select.selectedOptions[0];
  if (opt && opt.dataset.usable) {
    qtyInput.max = opt.dataset.usable;
    qtyInput.value = '1';
  }
}

/**
 * Adds an item to the draft cart before bill generation.
 */
function addBillItem() {
  const select = document.getElementById('bill-med-select');
  const qtyInput = document.getElementById('bill-qty-input');

  const medName = select.value;
  const quantity = parseInt(qtyInput.value, 10);

  if (!medName) {
    showToast('Please select a medicine first.', 'error');
    return;
  }

  if (isNaN(quantity) || quantity <= 0) {
    showToast('Please enter a valid positive quantity.', 'error');
    return;
  }

  // Find medicine in cache
  const med = currentMedicinesList.find(m => m.name.toLowerCase() === medName.toLowerCase());
  if (!med) {
    showToast('Selected medicine not found in inventory.', 'error');
    return;
  }

  // Check against usable non-expired stock
  const existingItemIndex = draftBillItems.findIndex(it => it.name.toLowerCase() === medName.toLowerCase());
  const alreadyInCart = existingItemIndex >= 0 ? draftBillItems[existingItemIndex].quantity : 0;
  const totalRequested = alreadyInCart + quantity;

  if (totalRequested > med.usableQty) {
    showToast(`Insufficient usable stock for ${med.name}. Only ${med.usableQty} units available.`, 'error');
    return;
  }

  if (existingItemIndex >= 0) {
    // Increase quantity in existing line
    draftBillItems[existingItemIndex].quantity = totalRequested;
  } else {
    // Add new draft line
    draftBillItems.push({
      name: med.name,
      price: med.price,
      quantity: quantity
    });
  }

  // Reset item inputs
  select.value = '';
  qtyInput.value = '1';

  renderBillCart();
}

/**
 * Removes an item from the draft bill cart.
 */
function removeBillItem(index) {
  draftBillItems.splice(index, 1);
  renderBillCart();
}

/**
 * Clears the entire draft bill cart and buyer name.
 */
function clearBillCart() {
  draftBillItems = [];
  document.getElementById('bill-buyer-input').value = 'Walk-in';
  renderBillCart();
}

/**
 * Re-renders the bill draft cart table and grand total bar.
 */
function renderBillCart() {
  const tbody = document.getElementById('bill-cart-tbody');
  const totalEl = document.getElementById('bill-grand-total');
  const genBtn = document.getElementById('btn-generate-bill');

  if (draftBillItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty-state" style="padding: 1.5rem;">No items added to bill yet. Select a medicine above.</td></tr>`;
    totalEl.textContent = '₹0.00';
    genBtn.disabled = true;
    return;
  }

  let grandTotal = 0;
  let html = draftBillItems.map((item, idx) => {
    const lineTotal = item.quantity * item.price;
    grandTotal += lineTotal;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.price)}</td>
        <td>${formatCurrency(lineTotal)}</td>
        <td style="text-align: center;">
          <button class="btn btn-danger btn-sm" onclick="removeBillItem(${idx})" aria-label="Remove item"><svg class="icon" width="14" height="14" aria-hidden="true"><use href="assets/icons.svg#trash-2"></use></svg></button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
  totalEl.textContent = formatCurrency(grandTotal);
  genBtn.disabled = false;
}

/**
 * Submits the bill request to the backend.
 * C++ backend consumes batches automatically using FEFO (First-Expiry-First-Out).
 * Route: POST /api/bills
 * Parameters: buyer, items="Paracetamol:2,Amoxicillin:1"
 */
async function generateBill() {
  if (draftBillItems.length === 0) {
    showToast('Add at least one medicine item to generate a bill.', 'error');
    return;
  }

  let buyer = document.getElementById('bill-buyer-input').value.trim();
  if (!buyer) buyer = 'Walk-in';

  // Format comma-separated items string: "MedicineName:Qty,..."
  const itemsString = draftBillItems.map(it => `${it.name}:${it.quantity}`).join(',');

  try {
    const res = await api('POST', '/api/bills', {
      buyer,
      items: itemsString
    });

    if (res.success && res.bill) {
      showToast(`Bill #${res.bill.id} generated successfully!`, 'success');

      // Clear draft cart
      draftBillItems = [];
      document.getElementById('bill-buyer-input').value = 'Walk-in';
      renderBillCart();

      // Refresh medicines dropdown (stock reduced) and bill history table
      loadBillingMedicines();
      loadBillHistory();
      loadDashboard();

      // Show final bill modal with the server's FEFO-allocated batches!
      displayGeneratedBillModal(res.bill);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Shows the final bill returned by the server (with batch allocation details) in a modal.
 */
function displayGeneratedBillModal(bill) {
  document.getElementById('view-bill-title').innerHTML = `<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#receipt"></use></svg> Bill Generated: #${escapeHtml(bill.id)}`;
  document.getElementById('view-bill-id').textContent = bill.id;
  document.getElementById('view-bill-date').textContent = formatDate(bill.date);
  document.getElementById('view-bill-buyer').textContent = bill.buyer;
  document.getElementById('view-bill-total').textContent = formatCurrency(bill.total);

  const tbody = document.getElementById('view-bill-items-tbody');
  tbody.innerHTML = (bill.items || []).map(it => `
    <tr>
      <td><strong>${escapeHtml(it.medicine)}</strong></td>
      <td><code>${escapeHtml(it.batch || '-')}</code></td>
      <td>${it.quantity}</td>
      <td>${formatCurrency(it.price)}</td>
      <td>${formatCurrency(it.total)}</td>
    </tr>
  `).join('');

  // Wire up the print receipt button inside this view modal
  const printBtn = document.getElementById('view-bill-print-btn');
  printBtn.onclick = () => printBillReceipt(bill.id);

  openModal('modal-bill-view');
}

/**
 * Fetches and displays bill history.
 * Route: GET /api/bills
 */
async function loadBillHistory() {
  const tbody = document.getElementById('bill-history-tbody');
  try {
    const list = await api('GET', '/api/bills');
    const bills = Array.isArray(list) ? list : [];

    if (bills.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty-state">No bills generated yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = bills.map(b => `
      <tr>
        <td><code>${escapeHtml(b.id)}</code></td>
        <td>${formatDate(b.date)}</td>
        <td><strong>${escapeHtml(b.buyer)}</strong></td>
        <td>${formatCurrency(b.total)}</td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="viewBillDetails('${escapeHtml(b.id)}')">
            <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#eye"></use></svg> View
          </button>
          <button class="btn btn-primary btn-sm" onclick="printBillReceipt('${escapeHtml(b.id)}')">
            <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#printer"></use></svg> Print
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty-state" style="color: var(--status-expired-text);">Failed to load bills: ${escapeHtml(err.message)}</td></tr>`;
    showToast(err.message, 'error');
  }
}

/**
 * Fetches JSON details for a specific bill and displays modal.
 * Route: GET /api/bills/{id}
 */
async function viewBillDetails(billId) {
  try {
    const bill = await api('GET', `/api/bills/${billId}`);
    displayGeneratedBillModal(bill);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Fetches plain-text formatted bill from C++ backend (operator<<) and shows in print preview modal.
 * Route: GET /api/bills/{id}/print
 */
async function printBillReceipt(billId) {
  try {
    const plainText = await api('GET', `/api/bills/${billId}/print`);

    const pre = document.getElementById('bill-print-pre');
    pre.textContent = plainText;

    // Close any open details modal
    closeModal('modal-bill-view');

    // Add print class to body so print CSS prints ONLY the bill modal
    document.body.classList.add('printing-bill-modal');

    openModal('modal-bill-print');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

/**
 * Closes the printable bill modal and cleans up body print classes.
 */
function closePrintModal() {
  document.body.classList.remove('printing-bill-modal');
  closeModal('modal-bill-print');
}

// =============================================================================
// 8. GENERIC MODAL CONTROLLER
// =============================================================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Shows confirmation modal with custom title, message and confirm callback.
 */
function openConfirmModal(title, message, onConfirm) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;

  const btn = document.getElementById('confirm-modal-btn');
  btn.onclick = () => {
    closeModal('modal-confirm');
    if (typeof onConfirm === 'function') onConfirm();
  };

  openModal('modal-confirm');
}

// =============================================================================
// 9. APP INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Load initial dashboard tab
  loadDashboard();

  // Pre-load medicines in background so dropdowns are warm
  loadBillingMedicines();

  // Keyboard shortcut: close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => {
        if (m.id === 'modal-bill-print') {
          closePrintModal();
        } else {
          m.classList.remove('active');
        }
      });
    }
  });
});

/**
 * Clears authentication flag and redirects to login page.
 */
function logout() {
  sessionStorage.removeItem('loggedIn');
  window.location.replace('login.html');
}

/**
 * Smoothly scrolls to the 10 KPI summary cards when 'Get Started' is clicked.
 */
function scrollToDashboardCards() {
  const cards = document.getElementById('dashboard-summary-cards');
  if (cards) {
    cards.scrollIntoView({ behavior: 'smooth' });
  }
}

