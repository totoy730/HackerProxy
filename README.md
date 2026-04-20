# HackerProxy 🔒

Firefox extension combining **FoxyProxy URL routing** + **PwnFox Burp color headers** in one tool.

## The problem
- **PwnFox** → colors in Burp ✅ but ALL traffic goes through proxy ❌  
- **FoxyProxy** → routes only target traffic ✅ but no colors in Burp ❌

## HackerProxy → both ✅

## Features
- Route only matching URLs through Burp (wildcard patterns like `*://target.com/*`)
- Injects `X-PwnFox-Color` header for color-coded Burp HTTP history
- Multiple proxy profiles with per-rule enable/disable
- Firefox container colors support
- Quick-add current domain with one click
- Export/Import config as JSON

## Installation

### Firefox (full features)
1. Download the latest `.zip` from [Releases](../../releases)
2. Firefox → `about:config` → set `xpinstall.signatures.required` to `false`
3. Firefox → `about:addons` → gear icon → "Install Add-on From File" → select the `.zip`

### Burp Suite
1. Burp → Extensions → Add → Java
2. Load `PwnFox.jar` (handles `X-PwnFox-Color` headers automatically)

## Usage
1. Click the HackerProxy toolbar icon
2. Open **⚙ Settings** → create a proxy rule
3. Add URL patterns for your target
4. Pick a Burp highlight color
5. Enable the rule + flip the global **ON** toggle

## Credits
- [PwnFox](https://github.com/yeswehack/PwnFox) by YesWeHack — color header concept
- [FoxyProxy](https://github.com/foxyproxy/browser-extension) — URL pattern routing concept

## License
GPL-2.0
