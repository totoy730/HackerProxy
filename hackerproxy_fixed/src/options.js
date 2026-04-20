'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const BURP_COLORS = [
  'red', 'orange', 'yellow', 'green',
  'cyan', 'blue', 'pink', 'magenta',
  'gray', 'white'
];

const COLOR_CSS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6',
  pink: '#ec4899', magenta: '#a855f7', gray: '#6b7280', white: '#e5e7eb'
};

// ─── State ───────────────────────────────────────────────────────────────────
let state = null;
let selectedRuleId = null;
let editingRule = null;  // working copy of the rule being edited

// ─── DOM ─────────────────────────────────────────────────────────────────────
const ruleItems   = document.getElementById('ruleItems');
const noSelection = document.getElementById('noSelection');
const ruleEditor  = document.getElementById('ruleEditor');
const editorTitle = document.getElementById('editorTitle');
const colorGrid   = document.getElementById('colorGrid');
const patternsList = document.getElementById('patternsList');
const toast       = document.getElementById('toast');

const fieldName   = document.getElementById('fieldName');
const fieldHost   = document.getElementById('fieldHost');
const fieldPort   = document.getElementById('fieldPort');
const fieldType   = document.getElementById('fieldType');

const btnNewRule    = document.getElementById('btnNewRule');
const btnSaveRule   = document.getElementById('btnSaveRule');
const btnDeleteRule = document.getElementById('btnDeleteRule');
const btnCancel     = document.getElementById('btnCancel');
const btnAddPattern = document.getElementById('btnAddPattern');
const btnExport     = document.getElementById('btnExport');
const btnImport     = document.getElementById('btnImport');
const importFile    = document.getElementById('importFile');
const btnReset      = document.getElementById('btnReset');

const settingContainerColors = document.getElementById('settingContainerColors');

// ─── Toast ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' ' + type : '') + ' show';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ─── Render sidebar ──────────────────────────────────────────────────────────
function renderSidebar() {
  const rules = state?.rules || [];

  if (rules.length === 0) {
    ruleItems.innerHTML = `
      <div style="padding:24px 16px;text-align:center;color:#3a5070;font-size:12px;line-height:1.7">
        No rules yet.<br>Click <strong>+ New</strong> to add one.
      </div>`;
    return;
  }

  ruleItems.innerHTML = rules.map(rule => {
    const color = COLOR_CSS[rule.color] || '#6b7280';
    const isActive = rule.id === selectedRuleId;
    return `
      <div class="rule-item ${isActive ? 'active' : ''}" data-id="${rule.id}">
        <div class="rule-item-color" style="background:${color}"></div>
        <div class="rule-item-info">
          <div class="rule-item-name">${escHtml(rule.name)}</div>
          <div class="rule-item-proxy">${escHtml(rule.proxyHost)}:${rule.proxyPort}</div>
        </div>
        <div class="rule-item-actions">
          <label class="toggle">
            <input type="checkbox" class="item-enable" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}>
            <div class="track"></div>
            <div class="thumb"></div>
          </label>
        </div>
      </div>`;
  }).join('');

  // Click rule → select it
  ruleItems.querySelectorAll('.rule-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-enable')) return;
      selectRule(el.dataset.id);
    });
  });

  // Enable toggle per rule
  ruleItems.querySelectorAll('.item-enable').forEach(cb => {
    cb.addEventListener('change', async () => {
      const rule = state.rules.find(r => r.id === cb.dataset.id);
      if (rule) {
        rule.enabled = cb.checked;
        await saveState();
      }
    });
  });
}

// ─── Color grid ──────────────────────────────────────────────────────────────
function renderColorGrid(selectedColor) {
  colorGrid.innerHTML = BURP_COLORS.map(c => `
    <div class="color-swatch ${c === selectedColor ? 'selected' : ''}"
         data-color="${c}"
         title="${c}"
         style="background:${COLOR_CSS[c]}">
    </div>`).join('');

  colorGrid.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorGrid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      if (editingRule) editingRule.color = swatch.dataset.color;
    });
  });
}

// ─── Patterns editor ─────────────────────────────────────────────────────────
function renderPatterns(patterns = []) {
  patternsList.innerHTML = patterns.map((p, i) => `
    <div class="pattern-row" data-index="${i}">
      <input type="text" class="pattern-input" value="${escAttr(p)}" placeholder="*://example.com/*">
      <button class="btn btn-danger btn-icon remove-pattern" data-index="${i}" title="Remove">✕</button>
    </div>`).join('');

  patternsList.querySelectorAll('.pattern-input').forEach(inp => {
    inp.addEventListener('input', () => syncPatternsFromDOM());
  });

  patternsList.querySelectorAll('.remove-pattern').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      if (editingRule) {
        editingRule.patterns.splice(i, 1);
        renderPatterns(editingRule.patterns);
      }
    });
  });
}

function syncPatternsFromDOM() {
  if (!editingRule) return;
  editingRule.patterns = Array.from(
    patternsList.querySelectorAll('.pattern-input')
  ).map(inp => inp.value.trim()).filter(Boolean);
}

// ─── Rule selection ───────────────────────────────────────────────────────────
function selectRule(ruleId) {
  const rule = state.rules.find(r => r.id === ruleId);
  if (!rule) return;

  selectedRuleId = ruleId;
  editingRule = JSON.parse(JSON.stringify(rule)); // deep copy

  noSelection.style.display = 'none';
  ruleEditor.style.display  = 'block';
  editorTitle.textContent   = 'Edit Rule';

  // Populate fields
  fieldName.value = rule.name;
  fieldHost.value = rule.proxyHost;
  fieldPort.value = rule.proxyPort;
  fieldType.value = rule.proxyType || 'http';

  renderColorGrid(rule.color);
  renderPatterns(rule.patterns || []);
  renderSidebar();
}

// ─── New rule ─────────────────────────────────────────────────────────────────
function startNewRule() {
  const newRule = {
    id: 'r' + Date.now().toString(36),
    name: 'New Rule',
    proxyHost: '127.0.0.1',
    proxyPort: 8080,
    proxyType: 'http',
    color: 'green',
    enabled: false,
    patterns: []
  };

  state.rules.push(newRule);
  selectedRuleId = newRule.id;
  editingRule = JSON.parse(JSON.stringify(newRule));

  noSelection.style.display = 'none';
  ruleEditor.style.display  = 'block';
  editorTitle.textContent   = 'New Rule';

  fieldName.value = '';
  fieldHost.value = '127.0.0.1';
  fieldPort.value = 8080;
  fieldType.value = 'http';

  renderColorGrid('green');
  renderPatterns([]);
  renderSidebar();

  fieldName.focus();
}

// ─── Save rule ────────────────────────────────────────────────────────────────
async function saveCurrentRule() {
  syncPatternsFromDOM();

  if (!editingRule) return;

  // Validate
  const name = fieldName.value.trim();
  const host = fieldHost.value.trim();
  const port = parseInt(fieldPort.value, 10);

  if (!name)               { showToast('⚠ Rule name is required', 'error'); fieldName.focus(); return; }
  if (!host)               { showToast('⚠ Proxy host is required', 'error'); fieldHost.focus(); return; }
  if (!port || port < 1 || port > 65535) { showToast('⚠ Invalid port (1-65535)', 'error'); fieldPort.focus(); return; }

  editingRule.name      = name;
  editingRule.proxyHost = host;
  editingRule.proxyPort = port;
  editingRule.proxyType = fieldType.value;

  // Apply color from swatch
  const selectedSwatch = colorGrid.querySelector('.color-swatch.selected');
  if (selectedSwatch) editingRule.color = selectedSwatch.dataset.color;

  // Update or add to state
  const idx = state.rules.findIndex(r => r.id === editingRule.id);
  if (idx >= 0) {
    state.rules[idx] = editingRule;
  } else {
    state.rules.push(editingRule);
  }

  await saveState();
  selectRule(editingRule.id);
  showToast('✓ Rule saved');
}

// ─── Delete rule ──────────────────────────────────────────────────────────────
async function deleteCurrentRule() {
  if (!selectedRuleId) return;
  if (!confirm('Delete this rule?')) return;

  state.rules = state.rules.filter(r => r.id !== selectedRuleId);
  selectedRuleId = null;
  editingRule = null;

  noSelection.style.display = 'block';
  ruleEditor.style.display  = 'none';

  await saveState();
  showToast('Rule deleted');
}

// ─── State management ─────────────────────────────────────────────────────────
async function loadState() {
  try {
    const data = await browser.storage.local.get('hackerproxy_state');
    state = data.hackerproxy_state || {
      enabled: false,
      useContainerColors: false,
      rules: []
    };
  } catch (e) {
    state = { enabled: false, useContainerColors: false, rules: [] };
  }
}

async function saveState() {
  await browser.storage.local.set({ hackerproxy_state: state });
  renderSidebar();
  settingContainerColors.checked = !!state.useContainerColors;
}

// ─── Export / Import ─────────────────────────────────────────────────────────
btnExport.addEventListener('click', () => {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'hackerproxy-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ Config exported');
});

btnImport.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!imported.rules || !Array.isArray(imported.rules)) {
      showToast('⚠ Invalid config file', 'error');
      return;
    }

    state = imported;
    await saveState();
    selectedRuleId = null;
    editingRule = null;
    noSelection.style.display = 'block';
    ruleEditor.style.display  = 'none';
    showToast(`✓ Imported ${state.rules.length} rule(s)`);
  } catch (_) {
    showToast('⚠ Failed to parse config file', 'error');
  }

  importFile.value = '';
});

// ─── Reset ────────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', async () => {
  if (!confirm('Reset ALL settings? This cannot be undone.')) return;
  state = { enabled: false, useContainerColors: false, rules: [] };
  await saveState();
  selectedRuleId = null;
  editingRule = null;
  noSelection.style.display = 'block';
  ruleEditor.style.display  = 'none';
  showToast('Settings reset');
});

// ─── Event bindings ───────────────────────────────────────────────────────────
btnNewRule.addEventListener('click', startNewRule);
btnSaveRule.addEventListener('click', saveCurrentRule);
btnDeleteRule.addEventListener('click', deleteCurrentRule);
btnCancel.addEventListener('click', () => {
  if (selectedRuleId) selectRule(selectedRuleId);
});

btnAddPattern.addEventListener('click', () => {
  if (!editingRule) return;
  syncPatternsFromDOM();
  editingRule.patterns.push('');
  renderPatterns(editingRule.patterns);
  // Focus the new pattern input
  const inputs = patternsList.querySelectorAll('.pattern-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

settingContainerColors.addEventListener('change', async () => {
  state.useContainerColors = settingContainerColors.checked;
  await saveState();
  showToast(state.useContainerColors ? 'Container colors ON' : 'Container colors OFF');
});

// Keyboard save
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (ruleEditor.style.display !== 'none') saveCurrentRule();
  }
});

// ─── Utilities ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await loadState();
  settingContainerColors.checked = !!state.useContainerColors;
  renderSidebar();
})();
