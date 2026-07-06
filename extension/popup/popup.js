// ponytail: single file handles auth + verify + UI state. Split when it hurts.

const API_BASE = 'http://localhost:8000/api/v1'; // ponytail: swap to Render URL at deploy

// ── DOM refs ──
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const authError = document.getElementById('auth-error');
const nameGroup = document.getElementById('name-group');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const resultState = document.getElementById('result-state');
const quotaBanner = document.getElementById('quota-banner');
const openSidepanel = document.getElementById('open-sidepanel');
const retryBtn = document.getElementById('retry-btn');
const logoutBtn = document.getElementById('logout-btn');

let isRegister = false;
let lastClaim = '';

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  const { access_token } = await chrome.storage.session.get('access_token');
  if (access_token) {
    showMain();
    loadQuota(access_token);
    checkPendingClaim(access_token);
  } else {
    showAuth();
  }
});

// ── Auth toggle ──
authToggle.addEventListener('click', () => {
  isRegister = !isRegister;
  authTitle.textContent = isRegister ? 'Create Account' : 'Sign In';
  authSubmit.textContent = isRegister ? 'Create Account' : 'Sign In';
  authToggle.textContent = isRegister ? 'Already have an account?' : 'Create account';
  nameGroup.hidden = !isRegister;
});

// ── Auth submit ──
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.hidden = true;
  authSubmit.disabled = true;

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const endpoint = isRegister ? '/auth/register' : '/auth/login';

  const body = { email, password };
  if (isRegister) body.name = document.getElementById('auth-name').value.trim();

  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Authentication failed');

    await chrome.storage.session.set({ access_token: data.access_token });
    await chrome.storage.local.set({ refresh_token: data.refresh_token });
    showMain();
    loadQuota(data.access_token);
  } catch (err) {
    authError.textContent = err.message;
    authError.hidden = false;
  } finally {
    authSubmit.disabled = false;
  }
});

// ── Logout ──
logoutBtn.addEventListener('click', async () => {
  const { refresh_token } = await chrome.storage.local.get('refresh_token');
  const { access_token } = await chrome.storage.session.get('access_token');
  try {
    await fetch(API_BASE + '/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({ refresh_token }),
    });
  } catch { /* best-effort */ }
  await chrome.storage.session.remove('access_token');
  await chrome.storage.local.remove('refresh_token');
  showAuth();
});

// ── Open side panel ──
openSidepanel.addEventListener('click', async (e) => {
  e.preventDefault();
  // ponytail: sidePanel.open needs a windowId
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// ── Retry ──
retryBtn.addEventListener('click', async () => {
  const { access_token } = await chrome.storage.session.get('access_token');
  if (lastClaim && access_token) verifyClaim(lastClaim, access_token);
});

// ── Check if background sent a claim ──
async function checkPendingClaim(token) {
  const { pending_claim } = await chrome.storage.session.get('pending_claim');
  if (pending_claim) {
    await chrome.storage.session.remove('pending_claim');
    verifyClaim(pending_claim, token);
  }
}

// ── Verify claim ──
async function verifyClaim(claim, token) {
  lastClaim = claim;
  showState('loading');

  try {
    token = await ensureFreshToken(token);
    const res = await fetch(API_BASE + '/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ claim_text: claim }),
    });

    if (res.status === 429) {
      showError('Daily limit reached. Resets at midnight UTC.');
      return;
    }
    if (!res.ok) throw new Error('Verification failed');

    const data = await res.json();
    renderResult(data);
    // Store for side panel
    await chrome.storage.session.set({ last_result: data, last_claim: claim });
  } catch (err) {
    showError(err.message || "Couldn't reach verification service.");
  }
}

// ── Token refresh ──
async function ensureFreshToken(token) {
  // ponytail: just try the token. If 401, refresh. No preemptive expiry check.
  const probe = await fetch(API_BASE + '/usage', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (probe.status !== 401) return token;

  const { refresh_token } = await chrome.storage.local.get('refresh_token');
  if (!refresh_token) { showAuth(); throw new Error('Session expired'); }

  const res = await fetch(API_BASE + '/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) { showAuth(); throw new Error('Session expired'); }

  const data = await res.json();
  await chrome.storage.session.set({ access_token: data.access_token });
  await chrome.storage.local.set({ refresh_token: data.refresh_token });
  return data.access_token;
}

// ── Quota ──
async function loadQuota(token) {
  try {
    const res = await fetch(API_BASE + '/usage', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      quotaBanner.textContent = `${data.checks_today} / ${data.daily_limit} checks today`;
    }
  } catch { /* silent */ }
}

// ── Render result ──
function renderResult(data) {
  showState('result');
  const badge = document.getElementById('verdict-badge');
  const conf = document.getElementById('confidence');
  const expl = document.getElementById('explanation');

  const verdictMap = {
    'likely_true': { label: 'Likely True', cls: 'true' },
    'needs_context': { label: 'Needs Context', cls: 'context' },
    'likely_false': { label: 'Likely False', cls: 'false' },
  };
  const v = verdictMap[data.verdict] || verdictMap['needs_context'];

  badge.textContent = v.label;
  badge.className = `verdict-badge ${v.cls}`;
  conf.textContent = data.confidence != null ? `${data.confidence}%` : '—';
  expl.textContent = data.explanation || '';
}

// ── UI state helpers ──
function showState(state) {
  emptyState.hidden = state !== 'empty';
  loadingState.hidden = state !== 'loading';
  errorState.hidden = state !== 'error';
  resultState.hidden = state !== 'result';
}

function showAuth() {
  authView.hidden = false;
  mainView.hidden = true;
}

function showMain() {
  authView.hidden = true;
  mainView.hidden = false;
  showState('empty');
}

function showError(msg) {
  showState('error');
  document.getElementById('error-msg').textContent = msg;
}

// ── Listen for messages from background ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CLAIM_READY') {
    chrome.storage.session.get('access_token').then(({ access_token }) => {
      if (access_token) verifyClaim(msg.claim, access_token);
    });
  }
});
