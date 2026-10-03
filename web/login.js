/**
 * Medical Inventory Management System - Login Logic
 * Frontend authentication for pharmacy owner / administrator.
 */

// Fixed credentials for the pharmacy owner
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'medical@123';

// Guard: if already logged in, redirect directly to dashboard
if (sessionStorage.getItem('loggedIn') === 'true') {
  window.location.replace('index.html');
}

/**
 * Handles login form submission.
 */
function handleLoginSubmit(event) {
  if (event && event.preventDefault) {
    event.preventDefault();
  }

  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorBanner = document.getElementById('login-error-msg');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Hide error banner if previously visible
    if (errorBanner) errorBanner.style.display = 'none';

    // Store login session flag
    sessionStorage.setItem('loggedIn', 'true');

    // Redirect to main application
    window.location.replace('index.html');
  } else {
    // Display inline error message without alert() popups
    if (errorBanner) {
      errorBanner.style.display = 'flex';
    }
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
  }
}

/**
 * Toggles password input visibility between password and text.
 */
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('login-password');
  const eyeIcon = document.getElementById('eye-icon');
  if (!passwordInput || !eyeIcon) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    // Slash eye icon
    eyeIcon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    `;
  } else {
    passwordInput.type = 'password';
    // Standard eye icon
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    `;
  }
}
