'use strict';
// HackerProxy — background.js
// Handles: proxy routing (FoxyProxy-style) + X-PwnFox-Color header injection

let state = null;

// tabId → color string from Firefox container identity
const tabContainerColors = new Map();

// ─────────────────────────────────────────────────────────────
// Pattern matching
// Supports: *://example.com/* glob patterns
// ─────────────────────────────────────────────────────────────
function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex special chars
    .replace(/\*/g, '.*')                    // * → .*
    .replace(/\?/g, '.');                    // ? → .
  return new RegExp('^' + escaped + '$', 'i');
}

function urlMatchesPattern(url, pattern) {
  if (!pattern || !url) return false;
  try {
    return patternToRegex(pattern).test(url);
  } catch (_) {
    return false;
  }
}

function findMatchingRule(url) {
  if (!state?.enabled) return null;

  for (const rule of state.rules) {
    if (!rule.enabled) continue;
    if (!rule.patterns || rule.patterns.length === 0) continue;

    for (const pattern of rule.patterns) {
      if (urlMatchesPattern(url, pattern)) return rule;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Proxy routing listener
// Returns proxy config for matched URLs, DIRECT for everything else
// ─────────────────────────────────────────────────────────────
browser.proxy.onRequest.addListener(
  (details) => {
    const rule = findMatchingRule(details.url);
    if (rule) {
      return {
        type: rule.proxyType || 'http',
        host: rule.proxyHost || '127.0.0.1',
        port: parseInt(rule.proxyPort, 10) || 8080
      };
    }
    return { type: 'direct' };
  },
  { urls: ['<all_urls>'] }
);

browser.proxy.onError.addListener((err) => {
  console.error('[HackerProxy] Proxy error:', err.message);
});

// ─────────────────────────────────────────────────────────────
// Header injection listener
// Injects X-PwnFox-Color for requests that go through a proxy rule
// Strips any existing x-pwnfox-* headers first (clean slate)
// ─────────────────────────────────────────────────────────────
browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const rule = findMatchingRule(details.url);
    if (!rule) return {};

    // Determine color: container color takes priority if enabled
    let color = rule.color || 'orange';

    if (state?.useContainerColors && details.tabId > 0) {
      const containerColor = tabContainerColors.get(details.tabId);
      if (containerColor) color = containerColor;
    }

    // Strip old pwnfox headers, then add fresh one
    const headers = (details.requestHeaders || []).filter(
      h => !h.name.toLowerCase().startsWith('x-pwnfox-')
    );

    headers.push({ name: 'X-PwnFox-Color', value: color });

    return { requestHeaders: headers };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders']
);

// ─────────────────────────────────────────────────────────────
// Container color tracking (Firefox only)
// Keeps a live map of tabId → container color
// ─────────────────────────────────────────────────────────────
async function syncTabContainerColor(tabId) {
  if (!tabId || tabId < 0) return;
  try {
    const tab = await browser.tabs.get(tabId);
    const storeId = tab?.cookieStoreId;
    if (storeId && storeId !== 'firefox-default' && storeId !== 'firefox-private') {
      const identity = await browser.contextualIdentities.get(storeId);
      if (identity?.color) {
        tabContainerColors.set(tabId, identity.color);
        return;
      }
    }
  } catch (_) {
    // Tab gone or no containers API — ignore
  }
  tabContainerColors.delete(tabId);
}

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.cookieStoreId !== undefined) {
    syncTabContainerColor(tabId);
  }
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  syncTabContainerColor(tabId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  tabContainerColors.delete(tabId);
});

// ─────────────────────────────────────────────────────────────
// State management
// State lives in storage; background keeps an in-memory copy
// ─────────────────────────────────────────────────────────────
async function init() {
  state = await Config.load();
  console.log('[HackerProxy] Loaded. Enabled:', state.enabled, '| Rules:', state.rules.length);

  // Pre-fill container colors for all open tabs
  try {
    const tabs = await browser.tabs.query({});
    tabs.forEach(tab => syncTabContainerColor(tab.id));
  } catch (_) {}
}

browser.storage.onChanged.addListener((changes) => {
  if (changes[Config.STORAGE_KEY]) {
    state = changes[Config.STORAGE_KEY].newValue;
    console.log('[HackerProxy] State updated. Enabled:', state?.enabled);
  }
});

// Message bridge for popup/options communication
browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case 'getState':
      return state;

    case 'setState':
      state = msg.state;
      await Config.save(state);
      return { ok: true };

    case 'getActiveTab': {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    }

    default:
      return null;
  }
});

init();
