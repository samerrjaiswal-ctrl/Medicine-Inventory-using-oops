/**
 * Medical Inventory Management System - UI Motion & Visual Enhancements
 * Purely visual layer: smooth transitions, sliding tab indicator,
 * number count-up animations, and Lucide SVG icon utilities.
 * Loaded after script.js. Functionality and API calls remain untouched.
 */

// =============================================================================
// 1. MOTION TOKENS & ICON UTILITY
// =============================================================================

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Generates an accessible Lucide SVG icon referencing assets/icons.svg sprite.
 *
 * @param {string} name - Icon symbol ID in icons.svg
 * @param {string} [className='icon'] - CSS class names
 * @param {number} [size=16] - Width & height in px
 * @returns {string} HTML string for the SVG icon
 */
function uiIcon(name, className = 'icon', size = 16) {
  return `<svg class="${className}" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="assets/icons.svg#${name}"></use></svg>`;
}

// Expose globally so script.js can use it for dynamic templates
window.uiIcon = uiIcon;

// =============================================================================
// 2. SLIDING ACTIVE TAB INDICATOR
// =============================================================================

function updateSlidingTabIndicator() {
  const navTabs = document.querySelector('.nav-tabs');
  const activeBtn = document.querySelector('.nav-tab-btn.active');
  let indicator = document.getElementById('nav-tab-indicator');

  if (!navTabs || !activeBtn) return;

  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'nav-tab-indicator';
    indicator.className = 'nav-tab-indicator';
    navTabs.appendChild(indicator);
  }

  const navRect = navTabs.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();

  const left = btnRect.left - navRect.left;
  const width = btnRect.width;

  if (prefersReducedMotion) {
    indicator.style.transition = 'none';
  } else {
    indicator.style.transition = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), width 260ms cubic-bezier(0.2, 0.8, 0.2, 1)';
  }

  indicator.style.transform = `translateX(${left}px)`;
  indicator.style.width = `${width}px`;
}

// Update sliding indicator on tab switch and window resize
window.addEventListener('resize', () => {
  requestAnimationFrame(updateSlidingTabIndicator);
});

// Hook into existing switchTab without modifying its core functionality
const originalSwitchTab = window.switchTab;
if (typeof originalSwitchTab === 'function') {
  window.switchTab = function (tabId) {
    originalSwitchTab(tabId);
    requestAnimationFrame(() => {
      updateSlidingTabIndicator();
      animateTabTransition(tabId);
    });
  };
}

/**
 * Smooth entrance animation for tab content.
 */
function animateTabTransition(tabId) {
  if (prefersReducedMotion) return;
  document.querySelectorAll('.tab-pane').forEach(p => {
    if (p.id !== `pane-${tabId}`) {
      p.classList.remove('tab-anim-in');
    }
  });
  const pane = document.getElementById(`pane-${tabId}`);
  if (!pane) return;

  pane.classList.remove('tab-anim-in');
  void pane.offsetWidth; // Force reflow
  pane.classList.add('tab-anim-in');
}

// =============================================================================
// 3. ANIMATED COUNT-UP FOR DASHBOARD NUMBERS
// =============================================================================

/**
 * Smoothly interpolates an element's text from 0 to its target numeric value.
 * Guaranteed to end on the exact string value provided by the backend API.
 *
 * @param {HTMLElement} element - Target DOM element
 * @param {number} targetValue - Final target number
 * @param {boolean} [isCurrency=false] - Whether to format as ₹ currency
 * @param {number} [duration=750] - Animation duration in ms (capped at 900ms)
 */
function animateCountUp(element, targetValue, isCurrency = false, duration = 750) {
  if (!element) return;

  if (prefersReducedMotion || isNaN(targetValue)) {
    element.textContent = isCurrency ? formatCurrency(targetValue) : String(targetValue);
    return;
  }

  const startTime = performance.now();
  const startValue = 0;
  const diff = targetValue - startValue;

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Easing out cubic
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentNum = startValue + diff * easeOut;

    if (isCurrency) {
      element.textContent = '₹' + currentNum.toFixed(2);
    } else {
      element.textContent = Math.round(currentNum).toLocaleString('en-IN');
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      // Guarantee exact final value from backend
      element.textContent = isCurrency ? formatCurrency(targetValue) : String(targetValue);
    }
  }

  requestAnimationFrame(step);
}

// Hook into loadDashboard to trigger count-up when KPIs load
const originalLoadDashboard = window.loadDashboard;
if (typeof originalLoadDashboard === 'function') {
  window.loadDashboard = async function () {
    await originalLoadDashboard();

    // Trigger visual count-up on KPI cards after DOM is updated
    try {
      const kpis = [
        { id: 'kpi-medicines', isCurr: false },
        { id: 'kpi-batches', isCurr: false },
        { id: 'kpi-units', isCurr: false },
        { id: 'kpi-expired', isCurr: false },
        { id: 'kpi-near-expiry', isCurr: false },
        { id: 'kpi-low-stock', isCurr: false },
        { id: 'kpi-bills', isCurr: false },
        { id: 'kpi-today-sales', isCurr: true },
        { id: 'kpi-alert-count', isCurr: false }
      ];

      kpis.forEach(k => {
        const el = document.getElementById(k.id);
        if (!el) return;
        const text = el.textContent.replace(/[₹,\s]/g, '');
        const val = parseFloat(text);
        if (!isNaN(val)) {
          animateCountUp(el, val, k.isCurr, 750);
        }
      });
    } catch (e) {
      // Visual only; fail silently
    }
  };
}

// =============================================================================
// 4. HEADER SCROLL SHADOW & BLUR
// =============================================================================

function initHeaderScrollEffect() {
  const header = document.querySelector('.app-header');
  if (!header) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > 12) {
          header.classList.add('app-header--scrolled');
        } else {
          header.classList.remove('app-header--scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// =============================================================================
// 5. MODAL FOCUS & SCROLL-LOCK
// =============================================================================

const originalOpenModal = window.openModal;
if (typeof originalOpenModal === 'function') {
  window.openModal = function (modalId) {
    document.body.classList.add('modal-open');
    originalOpenModal(modalId);
  };
}

const originalCloseModal = window.closeModal;
if (typeof originalCloseModal === 'function') {
  window.closeModal = function (modalId) {
    document.body.classList.remove('modal-open');
    originalCloseModal(modalId);
  };
}

const originalClosePrintModal = window.closePrintModal;
if (typeof originalClosePrintModal === 'function') {
  window.closePrintModal = function () {
    document.body.classList.remove('modal-open');
    originalClosePrintModal();
  };
}

// =============================================================================
// 6. ASYNC BUTTON SPINNERS & TOTAL FLASH
// =============================================================================

// Login animation hook
const originalHandleLoginSubmit = window.handleLoginSubmit;
if (typeof originalHandleLoginSubmit === 'function') {
  window.handleLoginSubmit = function (event) {
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (username !== 'admin' || password !== 'medical@123') {
      const card = document.querySelector('.login-card');
      if (card) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      }
    }
    originalHandleLoginSubmit(event);
  };
}

// Logout animation hook
const originalLogout = window.logout;
if (typeof originalLogout === 'function') {
  window.logout = function () {
    document.body.classList.add('page-exit');
    setTimeout(() => {
      originalLogout();
    }, 200);
  };
}

// Grand Total Flash
const originalRenderBillCart = window.renderBillCart;
if (typeof originalRenderBillCart === 'function') {
  window.renderBillCart = function () {
    originalRenderBillCart();
    const totalEl = document.getElementById('bill-grand-total');
    if (totalEl) {
      totalEl.classList.remove('total-flash');
      void totalEl.offsetWidth;
      totalEl.classList.add('total-flash');
    }
  };
}

// Generate bill button spinner
const originalGenerateBill = window.generateBill;
if (typeof originalGenerateBill === 'function') {
  window.generateBill = async function () {
    const btn = document.getElementById('btn-generate-bill');
    if (btn) btn.classList.add('btn--loading');
    try {
      await originalGenerateBill();
    } finally {
      if (btn) btn.classList.remove('btn--loading');
    }
  };
}

// Add medicine button spinner
const originalSubmitAddMedicine = window.submitAddMedicine;
if (typeof originalSubmitAddMedicine === 'function') {
  window.submitAddMedicine = async function (e) {
    const btn = document.querySelector('#form-add-medicine button[type="submit"]');
    if (btn) btn.classList.add('btn--loading');
    try {
      await originalSubmitAddMedicine(e);
    } finally {
      if (btn) btn.classList.remove('btn--loading');
    }
  };
}

// =============================================================================
// 7. INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScrollEffect();
  setTimeout(updateSlidingTabIndicator, 100);
});
