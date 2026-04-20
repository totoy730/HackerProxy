'use strict';

// Valid Burp Suite highlight colors (must match Burp's internal names)
const BURP_COLORS = [
  'red', 'orange', 'yellow', 'green',
  'cyan', 'blue', 'pink', 'magenta',
  'gray', 'white'
];

// CSS hex values for each Burp color (for UI display)
const COLOR_CSS = {
  red:     '#ef4444',
  orange:  '#f97316',
  yellow:  '#eab308',
  green:   '#22c55e',
  cyan:    '#06b6d4',
  blue:    '#3b82f6',
  pink:    '#ec4899',
  magenta: '#a855f7',
  gray:    '#6b7280',
  white:   '#e5e7eb'
};

const DEFAULT_STATE = {
  enabled: false,
  useContainerColors: false,  // Firefox containers → override rule color
  rules: [
    {
      id: 'rule_burp_default',
      name: 'Burp Suite',
      proxyHost: '127.0.0.1',
      proxyPort: 8080,
      proxyType: 'http',    // 'http' | 'socks4' | 'socks5'
      color: 'orange',
      enabled: false,
      patterns: []          // e.g. ['*://target.com/*', '*://*.target.com/*']
    }
  ]
};

const Config = {
  STORAGE_KEY: 'hackerproxy_state',

  async load() {
    try {
      const data = await browser.storage.local.get(this.STORAGE_KEY);
      const saved = data[this.STORAGE_KEY];
      if (!saved) return this._defaults();
      // Merge to ensure new keys are present
      return {
        ...this._defaults(),
        ...saved,
        rules: (saved.rules || []).map(r => ({ ...this._defaultRule(), ...r }))
      };
    } catch (e) {
      console.error('[HackerProxy] Config.load error:', e);
      return this._defaults();
    }
  },

  async save(state) {
    await browser.storage.local.set({ [this.STORAGE_KEY]: state });
  },

  _defaults() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  },

  _defaultRule() {
    return {
      id: this.newId(),
      name: 'New Rule',
      proxyHost: '127.0.0.1',
      proxyPort: 8080,
      proxyType: 'http',
      color: 'green',
      enabled: false,
      patterns: []
    };
  },

  newRule(overrides = {}) {
    return { ...this._defaultRule(), ...overrides, id: this.newId() };
  },

  newId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
};
