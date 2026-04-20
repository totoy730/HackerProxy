'use strict';

// ─── Color helper ────────────────────────────────────────────────────────────
const COLOR_CSS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6',
  pink: '#ec4899', magenta: '#a855f7', gray: '#6b7280', white: '#e5e7eb'
};

// ─── State ───────────────────────────────────────────────────────────────────
let state = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const globalToggle    = document.getElementById('globalToggle');
const statusText      = document.getElementById('statusText');
const containerToggle = document.getElementById('containerToggle');
const rulesList       = document.getElementById('rulesList');
const btnAddRule      = document.getElementById('btnAddRule');
const btnAddDomain    = document.getElementById('btnAddDomain');
const btnOptions      = document.getElementById('btnOptions');
const toast           = document.getElementById('toast');

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg, ms = 1800) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), ms);
}

// ─── Render ──────────────────────────────────────────────────────────────────
function renderRules() {
  const rules = state?.rules || [];

  if (rules.length === 0) {
    rulesList.innerHTML = `
      <div class="empty-state">
        <div class="icon">⟳</div>
        <p>No proxy rules yet.<br>Add a rule to start routing traffic.</p>
        <div class="hint">Click [+] to create your first rule</div>
      </div>`;
    return;
  }

  rulesList.innerHTML = rules.map(rule => {
    const color   = COLOR_CSS[rule.color] || '#6b7280';
    const count   = rule.patterns?.length || 0;
    const hasP    = count > 0;
    const pLabel  = hasP ? `${count} pattern${count !== 1 ? 's' : ''}` : 'no patterns';

    return `
    <div class="rule-card" data-id="${rule.id}">
      <div class="rule-color-bar" style="background:${color}"></div>
      <div class="rule-info">
        <div class="rule-name">${escHtml(rule.name)}</div>
        <div class="rule-meta">
          <span class="rule-proxy">${escHtml(rule.proxyHost)}:${rule.proxyPort}</span>
          <span class="rule-patterns ${hasP ? 'has-patterns' : ''}">${pLabel}</span>
        </div>
      </div>
      <div class="rule-actions">
        <button class="btn-edit" data-id="${rule.id}" title="Edit rule">✎</button>
        <label class="toggle" title="Enable/disable this rule">
          <input type="checkbox" class="rule-toggle" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}>
          <div class="track"></div>
          <div class="thumb"></div>
        </label>
      </div>
    </div>`;
  }).join('');

  // Rule toggle handlers
  rulesList.querySelectorAll('.rule-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      const rule = state.rules.find(r => r.id === cb.dataset.id);
      if (rule) {
        rule.enabled = cb.checked;
        await saveState();
      }
    });
  });

  // Edit button handlers
  rulesList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
      window.close();
    });
  });
}

function updateHeaderUI() {
  const on = state?.enabled;
  globalToggle.checked  = !!on;
  statusText.textContent = on ? 'ON' : 'OFF';
  statusText.className = 'status-text ' + (on ? 'on' : 'off');
  containerToggle.checked = !!state?.useContainerColors;
}

// ─── State helpers ───────────────────────────────────────────────────────────
async function loadState() {
  try {
    const msg = await browser.runtime.sendMessage({ type: 'getState' });
    state = msg;
  } catch (_) {
    // Background not ready yet — load directly from storage
    const data = await browser.storage.local.get('hackerproxy_state');
    state = data.hackerproxy_state || { enabled: false, useContainerColors: false, rules: [] };
  }
}

async function saveState() {
  await browser.runtime.sendMessage({ type: 'setState', state });
  renderRules();
  updateHeaderUI();
}

// ─── Event listeners ─────────────────────────────────────────────────────────
globalToggle.addEventListener('change', async () => {
  state.enabled = globalToggle.checked;
  await saveState();
  showToast(state.enabled ? '▶ Proxy routing ON' : '■ Proxy routing OFF');
});

containerToggle.addEventListener('change', async () => {
  state.useContainerColors = containerToggle.checked;
  await saveState();
  showToast(state.useContainerColors ? 'Container colors ON' : 'Container colors OFF');
});

btnAddRule.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
  window.close();
});

btnOptions.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
  window.close();
});

btnAddDomain.addEventListener('click', async () => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.url) { showToast('⚠ No active tab URL'); return; }

    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol)) {
      showToast('⚠ Not an HTTP/HTTPS page');
      return;
    }

    const pattern = `${url.protocol}//${url.hostname}/*`;

    // Add to first enabled rule or first rule
    const target = state.rules.find(r => r.enabled) || state.rules[0];
    if (!target) {
      showToast('⚠ Create a rule first');
      return;
    }

    if (!target.patterns.includes(pattern)) {
      target.patterns.push(pattern);
      target.enabled = true;
      await saveState();
      showToast(`✓ Added: ${url.hostname}`);
    } else {
      showToast(`Already in: ${target.name}`);
    }
  } catch (e) {
    showToast('⚠ ' + e.message);
  }
});

// ─── Escape HTML ─────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ────────────────────────────────────────────────────────────────────
(async () => {
  await loadState();
  updateHeaderUI();
  renderRules();
})();
