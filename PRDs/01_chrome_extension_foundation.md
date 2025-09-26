name: "Chrome Extension Foundation"
description: |

## Purpose
Establish the core Chrome Extension architecture with proper manifest configuration, permission structure, and foundational components that all other features will build upon. This PRD defines the essential extension skeleton and development environment.

## Core Principles
1. **Context is King**: Include Chrome Extension API specifics and MV3 requirements
2. **Validation Loops**: Test on multiple Chrome versions and configurations
3. **Information Dense**: Use exact Chrome API methods and manifest properties
4. **Progressive Success**: Basic extension structure first, then add features
5. **Security First**: Minimal permissions, strong CSP, no inline scripts

---

## Goal
Create a minimal viable Chrome Extension structure that can be loaded in Chrome, establishes communication patterns between components, and provides the foundation for Steam/HLTB integration features.

## Why
- **Foundation**: All features depend on proper extension architecture
- **Security**: Manifest V3 requires specific patterns and permissions
- **Performance**: Proper structure ensures optimal extension performance
- **Maintainability**: Clean architecture makes feature additions straightforward
- **Distribution**: Chrome Web Store requires specific manifest structure

## What
Extension foundation providing:
- Manifest V3 configuration with minimal permissions
- Background service worker setup
- Content script injection framework
- Extension popup interface skeleton
- Message passing between components
- Chrome Storage API integration
- Error handling foundation
- Development and build tooling
- Testing framework setup
- Hot reload during development

### Success Criteria
- [ ] Extension loads in Chrome without errors
- [ ] Background service worker stays active when needed
- [ ] Content scripts inject on Steam pages
- [ ] Popup opens and displays basic UI
- [ ] Message passing works between all components
- [ ] Storage API saves and retrieves data
- [ ] Build process creates distributable extension
- [ ] Tests run and pass
- [ ] Hot reload works in development
- [ ] No console errors or warnings

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Critical Documentation
- url: https://developer.chrome.com/docs/extensions/mv3/intro/
  why: Manifest V3 migration guide and requirements
  sections: Key concepts, architecture overview

- url: https://developer.chrome.com/docs/extensions/mv3/manifest/
  why: Complete manifest.json reference
  sections: Required keys, permissions, host permissions

- url: https://developer.chrome.com/docs/extensions/mv3/service_workers/
  why: Background service worker requirements
  sections: Lifecycle, persistence, debugging

- url: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
  why: Content script injection patterns
  sections: Registration, isolated worlds, communication

- url: https://developer.chrome.com/docs/extensions/reference/runtime/
  why: Message passing API
  sections: sendMessage, onMessage, connect

- url: https://developer.chrome.com/docs/extensions/reference/storage/
  why: Chrome Storage API for persistence
  sections: local vs sync, quotas, performance

- file: C:\hltbsteam\HLTB_Steam_Extension_Design.md
  lines: 19-61
  why: Manifest structure and component overview

- url: https://github.com/PlasmoHQ/plasmo
  why: Modern extension framework option
  action: Evaluate if framework helps or adds complexity

- url: https://webpack.js.org/guides/getting-started/
  why: Bundle management for extension
  sections: Configuration, plugins, dev server
```

### Chrome Extension File Structure
```
hltbsteam/
├── manifest.json           # Extension manifest
├── background.js           # Service worker
├── content.js             # Content script
├── popup.html             # Extension popup
├── popup.js               # Popup logic
├── popup.css              # Popup styles
├── styles.css             # Content script styles
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/                   # Source code (if using build)
│   ├── background/
│   ├── content/
│   ├── popup/
│   └── shared/
├── dist/                  # Built extension
├── tests/                 # Test files
├── package.json          # Node dependencies
├── webpack.config.js     # Build configuration
└── .env                  # Environment variables
```

### Manifest V3 Key Changes from V2
```javascript
// CRITICAL: No more persistent background pages
// Service workers are event-driven and terminate when idle

// CRITICAL: No more arbitrary remote code execution
// All code must be bundled with extension

// CRITICAL: Host permissions are separate from permissions
// Users can grant/revoke host permissions at runtime

// CRITICAL: Content Security Policy is stricter
// No inline scripts, no eval(), no remote scripts

// CRITICAL: Some APIs changed or removed
// webRequest → declarativeNetRequest for most cases

// CRITICAL: Action API replaces browserAction and pageAction
// Single API for toolbar button
```

### Known Gotchas & Edge Cases
```typescript
// CRITICAL: Service worker terminates after 30s of inactivity
// Use chrome.alarms or events to keep alive when needed

// CRITICAL: Content scripts can't access extension:// URLs directly
// Must use runtime.getURL() for extension resources

// CRITICAL: Sync storage has quotas: 100KB total, 8KB per item
// Use local storage for larger data

// CRITICAL: Content scripts run in isolated world
// Can't access page's JavaScript variables directly

// CRITICAL: Permissions must be justified for Web Store review
// Only request what's absolutely necessary

// CRITICAL: Icons must be exactly specified sizes
// Chrome won't resize, will show default if missing

// CRITICAL: Popup closes when it loses focus
// Can't have long-running operations in popup

// CRITICAL: Background service worker has no DOM
// Can't use localStorage, must use chrome.storage

// CRITICAL: Message passing is async
// Always handle promise rejections

// CRITICAL: Extension IDs differ in development
// Use runtime.id for self-reference
```

## Implementation Blueprint

### Task 1: Manifest Configuration
```json
// manifest.json
{
  "manifest_version": 3,
  "name": "HLTB for Steam",
  "version": "1.0.0",
  "description": "Display HowLongToBeat completion times on Steam pages",

  // Minimal permissions - only what we need
  "permissions": [
    "storage",      // For caching HLTB data
    "alarms"        // For cache expiration
  ],

  // Host permissions separate in MV3
  "host_permissions": [
    "https://store.steampowered.com/*",
    "https://steamcommunity.com/*",
    "https://howlongtobeat.com/*"
  ],

  // Content scripts for Steam pages
  "content_scripts": [
    {
      "matches": [
        "https://store.steampowered.com/app/*",
        "https://steamcommunity.com/app/*"
      ],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_end"
    }
  ],

  // Service worker for background tasks
  "background": {
    "service_worker": "background.js",
    "type": "module"  // Enable ES6 modules
  },

  // Extension popup
  "action": {
    "default_popup": "popup.html",
    "default_title": "HLTB for Steam",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  // Extension icons
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  // Content Security Policy for MV3
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },

  // Optional: Chrome Web Store fields
  "author": "Your Name",
  "homepage_url": "https://github.com/yourusername/hltb-steam"
}
```

### Task 2: Background Service Worker
```javascript
// background.js
console.log('[HLTB] Background service worker started');

// Message handler for content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[HLTB] Received message:', request.action);

  switch(request.action) {
    case 'fetchHLTB':
      handleFetchHLTB(request, sendResponse);
      return true; // Will respond asynchronously

    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;

    case 'clearCache':
      handleClearCache(sendResponse);
      return true;

    default:
      console.warn('[HLTB] Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle HLTB data fetching
async function handleFetchHLTB(request, sendResponse) {
  try {
    const { gameTitle, appId } = request;

    // Check cache first
    const cacheKey = `hltb_${appId}`;
    const cached = await chrome.storage.local.get(cacheKey);

    if (cached[cacheKey] && !isCacheExpired(cached[cacheKey])) {
      console.log('[HLTB] Using cached data for:', gameTitle);
      sendResponse({ success: true, data: cached[cacheKey].data });
      return;
    }

    // Fetch fresh data (implementation in later PRD)
    console.log('[HLTB] Fetching fresh data for:', gameTitle);
    // Placeholder for actual HLTB fetching
    const hltbData = {
      mainStory: '12 Hours',
      mainExtra: '24 Hours',
      completionist: '48 Hours'
    };

    // Cache the result
    await chrome.storage.local.set({
      [cacheKey]: {
        data: hltbData,
        timestamp: Date.now(),
        gameTitle
      }
    });

    sendResponse({ success: true, data: hltbData });

  } catch (error) {
    console.error('[HLTB] Error fetching data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get extension settings
async function handleGetSettings(sendResponse) {
  try {
    const settings = await chrome.storage.local.get(['enabled', 'cacheEnabled', 'theme']);
    sendResponse({
      success: true,
      settings: {
        enabled: settings.enabled !== false, // Default true
        cacheEnabled: settings.cacheEnabled !== false, // Default true
        theme: settings.theme || 'auto'
      }
    });
  } catch (error) {
    console.error('[HLTB] Error getting settings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Clear cache
async function handleClearCache(sendResponse) {
  try {
    const keys = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(keys).filter(key => key.startsWith('hltb_'));
    await chrome.storage.local.remove(cacheKeys);
    console.log('[HLTB] Cleared cache entries:', cacheKeys.length);
    sendResponse({ success: true, cleared: cacheKeys.length });
  } catch (error) {
    console.error('[HLTB] Error clearing cache:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Check if cache entry is expired (7 days)
function isCacheExpired(cacheEntry) {
  const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  return Date.now() - cacheEntry.timestamp > CACHE_DURATION;
}

// Set up alarm for periodic cache cleanup
chrome.alarms.create('cleanupCache', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupCache') {
    cleanupExpiredCache();
  }
});

// Remove expired cache entries
async function cleanupExpiredCache() {
  const storage = await chrome.storage.local.get(null);
  const expiredKeys = [];

  for (const [key, value] of Object.entries(storage)) {
    if (key.startsWith('hltb_') && isCacheExpired(value)) {
      expiredKeys.push(key);
    }
  }

  if (expiredKeys.length > 0) {
    await chrome.storage.local.remove(expiredKeys);
    console.log('[HLTB] Cleaned up expired cache entries:', expiredKeys.length);
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[HLTB] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      enabled: true,
      cacheEnabled: true,
      theme: 'auto',
      installDate: Date.now()
    });

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'welcome.html' });
  }
});
```

### Task 3: Content Script Foundation
```javascript
// content.js
console.log('[HLTB] Content script loaded on:', window.location.href);

// Check if we're on a Steam game page
if (isGamePage()) {
  initializeExtension();
}

function isGamePage() {
  const url = window.location.href;
  return (
    url.includes('store.steampowered.com/app/') ||
    url.includes('steamcommunity.com/app/')
  );
}

async function initializeExtension() {
  try {
    // Check if extension is enabled
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

    if (!response.success || !response.settings.enabled) {
      console.log('[HLTB] Extension is disabled');
      return;
    }

    // Extract game info (simplified for foundation)
    const gameInfo = extractGameInfo();
    if (!gameInfo) {
      console.warn('[HLTB] Could not extract game info');
      return;
    }

    console.log('[HLTB] Game detected:', gameInfo);

    // Request HLTB data
    const hltbResponse = await chrome.runtime.sendMessage({
      action: 'fetchHLTB',
      gameTitle: gameInfo.title,
      appId: gameInfo.appId
    });

    if (hltbResponse.success) {
      console.log('[HLTB] Data received:', hltbResponse.data);
      injectHLTBData(hltbResponse.data);
    } else {
      console.error('[HLTB] Failed to fetch data:', hltbResponse.error);
    }

  } catch (error) {
    console.error('[HLTB] Extension error:', error);
  }
}

function extractGameInfo() {
  // Extract app ID from URL
  const url = window.location.href;
  const appIdMatch = url.match(/\/app\/(\d+)/);
  if (!appIdMatch) return null;

  // Extract game title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const gameTitle = ogTitle?.content || document.title.split(' on Steam')[0];

  return {
    appId: appIdMatch[1],
    title: gameTitle.trim()
  };
}

function injectHLTBData(data) {
  // Create container element
  const container = document.createElement('div');
  container.className = 'hltb-container';
  container.innerHTML = `
    <div class="hltb-header">
      <span class="hltb-logo">HLTB</span>
      <span class="hltb-title">HowLongToBeat</span>
    </div>
    <div class="hltb-times">
      <div class="hltb-time-box">
        <div class="hltb-label">Main Story</div>
        <div class="hltb-hours">${data.mainStory || 'N/A'}</div>
      </div>
      <div class="hltb-time-box">
        <div class="hltb-label">Main + Extra</div>
        <div class="hltb-hours">${data.mainExtra || 'N/A'}</div>
      </div>
      <div class="hltb-time-box">
        <div class="hltb-label">Completionist</div>
        <div class="hltb-hours">${data.completionist || 'N/A'}</div>
      </div>
    </div>
  `;

  // Find injection point (simplified)
  const purchaseArea = document.querySelector('.game_area_purchase');
  if (purchaseArea) {
    purchaseArea.parentNode.insertBefore(container, purchaseArea);
    console.log('[HLTB] UI injected successfully');
  } else {
    console.warn('[HLTB] Could not find injection point');
  }
}

// Handle dynamic navigation (Steam is a SPA)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('[HLTB] Navigation detected');
    if (isGamePage()) {
      initializeExtension();
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### Task 4: Popup Interface
```html
<!-- popup.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header class="popup-header">
      <h1>HLTB for Steam</h1>
      <span class="version">v1.0.0</span>
    </header>

    <main class="popup-content">
      <!-- Enable/Disable Toggle -->
      <div class="setting-row">
        <label for="enableToggle">Extension Enabled</label>
        <input type="checkbox" id="enableToggle" checked>
      </div>

      <!-- Cache Toggle -->
      <div class="setting-row">
        <label for="cacheToggle">Use Cache</label>
        <input type="checkbox" id="cacheToggle" checked>
      </div>

      <!-- Clear Cache Button -->
      <button id="clearCacheBtn" class="btn btn-secondary">
        Clear Cache
      </button>

      <!-- Status Section -->
      <div class="status-section">
        <div id="statusMessage"></div>
      </div>
    </main>

    <footer class="popup-footer">
      <a href="https://github.com/yourusername/hltb-steam" target="_blank">
        GitHub
      </a>
      <a href="#" id="reportIssue">Report Issue</a>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

```javascript
// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

  if (response.success) {
    const { settings } = response;
    document.getElementById('enableToggle').checked = settings.enabled;
    document.getElementById('cacheToggle').checked = settings.cacheEnabled;
  }

  // Handle enable toggle
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
    showStatus(e.target.checked ? 'Extension enabled' : 'Extension disabled');
  });

  // Handle cache toggle
  document.getElementById('cacheToggle').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ cacheEnabled: e.target.checked });
    showStatus(e.target.checked ? 'Cache enabled' : 'Cache disabled');
  });

  // Handle clear cache button
  document.getElementById('clearCacheBtn').addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ action: 'clearCache' });
    if (response.success) {
      showStatus(`Cleared ${response.cleared} cache entries`);
    }
  });

  // Handle report issue link
  document.getElementById('reportIssue').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/yourusername/hltb-steam/issues'
    });
  });
});

function showStatus(message) {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.style.display = 'block';
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}
```

### Task 5: Basic Styles
```css
/* styles.css - Content script styles */
.hltb-container {
  background: linear-gradient(to right, #2a475e, #1b2838);
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 16px;
  color: #c7d5e0;
  font-family: "Motiva Sans", Arial, sans-serif;
}

.hltb-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #3d5a7a;
}

.hltb-logo {
  background: #66c0f4;
  color: #1b2838;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: bold;
  margin-right: 8px;
}

.hltb-times {
  display: flex;
  gap: 12px;
}

.hltb-time-box {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.hltb-label {
  font-size: 11px;
  text-transform: uppercase;
  color: #8f98a0;
  margin-bottom: 4px;
}

.hltb-hours {
  font-size: 16px;
  font-weight: bold;
  color: #66c0f4;
}
```

## Validation Loop

### Level 1: Basic Functionality Tests
```bash
# Load extension in Chrome
1. Open chrome://extensions
2. Enable Developer Mode
3. Load unpacked extension
4. Verify no errors in extension card

# Test on Steam page
1. Navigate to https://store.steampowered.com/app/730/
2. Check console for [HLTB] logs
3. Verify HLTB container appears
4. Check network tab for HLTB requests

# Test popup
1. Click extension icon
2. Toggle settings
3. Clear cache
4. Verify settings persist
```

### Level 2: Component Communication Tests
```javascript
// tests/message-passing.test.js
test('Content script can message background', async () => {
  const response = await chrome.runtime.sendMessage({
    action: 'getSettings'
  });
  expect(response.success).toBe(true);
  expect(response.settings).toBeDefined();
});

test('Background responds to fetchHLTB', async () => {
  const response = await chrome.runtime.sendMessage({
    action: 'fetchHLTB',
    gameTitle: 'Test Game',
    appId: '12345'
  });
  expect(response.success).toBe(true);
  expect(response.data).toBeDefined();
});
```

### Level 3: Performance Tests
```javascript
// Verify minimal performance impact
test('Extension loads quickly', () => {
  const startTime = performance.now();
  // Load content script
  const loadTime = performance.now() - startTime;
  expect(loadTime).toBeLessThan(50); // 50ms max
});

test('No memory leaks', async () => {
  const initial = performance.memory.usedJSHeapSize;
  // Perform operations
  await new Promise(resolve => setTimeout(resolve, 1000));
  const final = performance.memory.usedJSHeapSize;
  expect(final - initial).toBeLessThan(1024 * 1024); // < 1MB growth
});
```

## Agent Task Assignments

### For `general-purpose` Agent:
- Create manifest.json with proper MV3 structure
- Implement background service worker
- Create content script foundation
- Build popup HTML and JavaScript
- Set up message passing

### For `component-architect` Agent:
- Design component communication architecture
- Structure storage schema
- Plan error handling patterns
- Define TypeScript interfaces (if using TS)

### For `test-strategy-architect` Agent:
- Create test suite for message passing
- Design integration tests
- Plan Chrome extension specific tests
- Set up automated testing pipeline

### For `security-reviewer` Agent:
- Audit manifest permissions
- Review content security policy
- Check for XSS vulnerabilities
- Validate message passing security

## Anti-Patterns to Avoid
- ❌ Don't use excessive permissions in manifest
- ❌ Don't use inline JavaScript (CSP violation)
- ❌ Don't forget to handle async message responses
- ❌ Don't use persistent background pages (removed in MV3)
- ❌ Don't access chrome APIs in content scripts without checking
- ❌ Don't hardcode extension ID
- ❌ Don't use eval() or new Function()
- ❌ Don't load remote scripts
- ❌ Don't forget error boundaries
- ❌ Don't leave console.logs in production

## Final Validation Checklist
- [ ] Extension loads without errors
- [ ] Manifest is valid MV3 format
- [ ] Background worker responds to messages
- [ ] Content script injects on Steam pages
- [ ] Popup opens and functions correctly
- [ ] Settings persist in storage
- [ ] Cache cleanup works
- [ ] No memory leaks
- [ ] All permissions justified
- [ ] CSP properly configured
- [ ] Icons display correctly
- [ ] Build process works
- [ ] Tests pass

---

## Confidence Score: 9/10
High confidence due to:
- Well-documented Chrome Extension APIs
- Clear MV3 requirements
- Simple initial architecture

Risk factors:
- Service worker lifecycle management
- Cross-origin request handling (for HLTB)
- Chrome Web Store approval requirements