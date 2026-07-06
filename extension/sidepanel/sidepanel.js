// ponytail: side panel reads last_result from storage + listens for live updates

const API_BASE = 'http://localhost:8000/api/v1';

const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const resultState = document.getElementById('result-state');
const retryBtn = document.getElementById('retry-btn');

let lastClaim = '';

document.addEventListener('DOMContentLoaded', async () => {
  const { last_result, last_claim } = await chrome.storage.session.get(['last_result', 'last_claim']);
  if (last_result && last_claim) {
    lastClaim = last_claim;
    renderResult(last_result, last_claim);
  }
});

// Listen for new results
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.last_result?.newValue) {
    chrome.storage.session.get('last_claim').then(({ last_claim }) => {
      renderResult(changes.last_result.newValue, last_claim || '');
    });
  }
});

// Listen for verify requests from background
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'CLAIM_READY') {
    lastClaim = msg.claim;
    showState('loading');
    const { access_token } = await chrome.storage.session.get('access_token');
    if (!access_token) {
      showError('Please sign in via the extension popup.');
      return;
    }
    try {
      const res = await fetch(API_BASE + '/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
        body: JSON.stringify({ claim_text: msg.claim }),
      });
      if (res.status === 429) { showError('Daily limit reached.'); return; }
      if (!res.ok) throw new Error('Verification failed');
      const data = await res.json();
      await chrome.storage.session.set({ last_result: data, last_claim: msg.claim });
      renderResult(data, msg.claim);
    } catch (err) {
      showError(err.message);
    }
  }
});

retryBtn.addEventListener('click', () => {
  if (lastClaim) {
    chrome.runtime.sendMessage({ type: 'VERIFY_CLAIM', claim: lastClaim });
    showState('loading');
  }
});

// Feedback
document.getElementById('fb-helpful').addEventListener('click', (e) => sendFeedback('helpful', e.target));
document.getElementById('fb-not-helpful').addEventListener('click', (e) => sendFeedback('not_helpful', e.target));

async function sendFeedback(value, btn) {
  const { access_token } = await chrome.storage.session.get('access_token');
  if (!access_token) return;
  try {
    await fetch(API_BASE + '/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({ claim_text: lastClaim, feedback: value }),
    });
    // Mark active
    document.querySelectorAll('.feedback button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } catch { /* best-effort */ }
}

function renderResult(data, claim) {
  showState('result');
  document.getElementById('claim-text').textContent = `"${claim}"`;

  const badge = document.getElementById('verdict-badge');
  const conf = document.getElementById('confidence');
  const expl = document.getElementById('explanation');
  const sourcesList = document.getElementById('sources-list');

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

  // Render sources
  sourcesList.innerHTML = '';
  (data.sources || []).forEach(src => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = src.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `${escapeHtml(src.title || src.url)} <span class="source-domain">↗ ${new URL(src.url).hostname}</span>`;
    li.appendChild(a);
    sourcesList.appendChild(li);
  });

  if ((data.sources || []).length === 0) {
    const li = document.createElement('li');
    li.style.color = 'var(--text-secondary)';
    li.textContent = 'No reliable match found yet.';
    sourcesList.appendChild(li);
  }
}

function showState(state) {
  emptyState.hidden = state !== 'empty';
  loadingState.hidden = state !== 'loading';
  errorState.hidden = state !== 'error';
  resultState.hidden = state !== 'result';
}

function showError(msg) {
  showState('error');
  document.getElementById('error-msg').textContent = msg;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
