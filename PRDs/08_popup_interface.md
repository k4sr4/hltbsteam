name: "Popup Interface"
description: |

## Purpose
Create an intuitive popup interface for extension settings, statistics, and quick actions, providing users control over the extension's behavior and insights into its performance.

## Core Principles
1. **Context is King**: Include Chrome Extension popup best practices
2. **Validation Loops**: Test all settings persist correctly
3. **Information Dense**: Use modern UI patterns
4. **Progressive Success**: Basic settings first, then advanced
5. **User Control**: Give users fine-grained control

---

## Goal
Build a clean, functional popup that allows users to configure the extension, view statistics, and perform quick actions like clearing cache.

## Why
- **User Control**: Users need to customize behavior
- **Transparency**: Show database info and match statistics
- **Quick Access**: Common actions without navigation
- **Trust Building**: Professional interface builds confidence
- **Community**: Encourage contributions to the game database

## What Changed from Original PRD
**Original Approach (Abandoned)**:
- ❌ API settings and rate limiting configuration
- ❌ Network request statistics
- ❌ Retry and timeout settings

**New Approach (Current)**:
- ✅ Database information (version, game count)
- ✅ Match statistics (games matched, confidence levels)
- ✅ "Suggest a Game" link to GitHub
- ✅ Simplified cache management (match results only)
- ✅ Offline-first messaging

## What
Popup interface providing:
- Enable/disable toggle
- Cache management
- Statistics display
- Settings configuration
- Quick actions
- About information
- Debug mode
- Export/import settings
- Theme selection
- Language support

### Success Criteria
- [ ] Opens in < 100ms
- [ ] Settings persist correctly
- [ ] Statistics update real-time
- [ ] All actions functional
- [ ] Responsive design
- [ ] Keyboard accessible
- [ ] Theme switching works
- [ ] No memory leaks
- [ ] Follows Chrome HIG
- [ ] Internationalization ready

## Implementation Blueprint

### Task 1: Popup HTML Structure
```html
<!-- src/popup/popup.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>HLTB for Steam</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <!-- Header -->
    <header class="popup-header">
      <img src="../icons/icon48.png" alt="HLTB" class="logo">
      <h1>HLTB for Steam</h1>
      <span class="version">v1.0.0</span>
    </header>

    <!-- Main Toggle -->
    <section class="main-toggle">
      <label class="switch">
        <input type="checkbox" id="enabled">
        <span class="slider"></span>
      </label>
      <span class="toggle-label">Extension Enabled</span>
    </section>

    <!-- Settings -->
    <section class="settings">
      <h2>Settings</h2>

      <div class="setting-group">
        <label>
          <input type="checkbox" id="cache-enabled">
          <span>Enable Caching</span>
        </label>
      </div>

      <div class="setting-group">
        <label>
          Cache Duration
          <select id="cache-duration">
            <option value="1">1 Day</option>
            <option value="3">3 Days</option>
            <option value="7" selected>7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
          </select>
        </label>
      </div>

      <div class="setting-group">
        <label>
          Display Position
          <select id="display-position">
            <option value="above-purchase">Above Purchase Area</option>
            <option value="game-details">In Game Details</option>
            <option value="sidebar">In Sidebar</option>
          </select>
        </label>
      </div>

      <div class="setting-group">
        <label>
          Theme
          <select id="theme">
            <option value="auto">Auto</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </div>
    </section>

    <!-- Database Info -->
    <section class="database-info">
      <h2>Database</h2>
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-value" id="db-version">1.0.0</span>
          <span class="stat-label">Database Version</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="db-games">100</span>
          <span class="stat-label">Games in Database</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="matches-count">0</span>
          <span class="stat-label">Games Matched</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="match-rate">0%</span>
          <span class="stat-label">Match Rate</span>
        </div>
      </div>
      <div class="contribute-box">
        <p>Missing a game? Help expand our database!</p>
        <a href="https://github.com/yourusername/hltb-steam/blob/master/ADDING_GAMES.md" target="_blank" class="btn btn-primary">
          Suggest a Game
        </a>
      </div>
    </section>

    <!-- Actions -->
    <section class="actions">
      <button id="clear-cache" class="btn btn-secondary">
        Clear Cache
      </button>
      <button id="refresh-current" class="btn btn-secondary">
        Refresh Current Page
      </button>
    </section>

    <!-- Footer -->
    <footer class="popup-footer">
      <a href="https://github.com/yourusername/hltb-steam" target="_blank">GitHub</a>
      <span>•</span>
      <a href="#" id="report-issue">Report Issue</a>
      <span>•</span>
      <a href="#" id="donate">Donate</a>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

### Task 2: Popup Styles
```css
/* src/popup/popup.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 350px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #1b2838;
  color: #c7d5e0;
}

.popup-container {
  display: flex;
  flex-direction: column;
}

/* Header */
.popup-header {
  display: flex;
  align-items: center;
  padding: 12px;
  background: linear-gradient(to right, #2a475e, #1b2838);
  border-bottom: 1px solid #000;
}

.popup-header .logo {
  width: 32px;
  height: 32px;
  margin-right: 8px;
}

.popup-header h1 {
  font-size: 16px;
  font-weight: 500;
  color: #ffffff;
  flex: 1;
}

.popup-header .version {
  font-size: 11px;
  color: #8f98a0;
}

/* Main Toggle */
.main-toggle {
  display: flex;
  align-items: center;
  padding: 16px;
  background: rgba(0,0,0,0.2);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
  margin-right: 12px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #4c5c70;
  transition: .3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #66c0f4;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
}

/* Settings */
.settings {
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.settings h2 {
  font-size: 12px;
  text-transform: uppercase;
  color: #8f98a0;
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}

.setting-group {
  margin-bottom: 12px;
}

.setting-group label {
  display: flex;
  align-items: center;
  font-size: 13px;
  cursor: pointer;
}

.setting-group input[type="checkbox"] {
  margin-right: 8px;
}

.setting-group select {
  background: #0e1621;
  color: #c7d5e0;
  border: 1px solid #4c5c70;
  padding: 4px 8px;
  border-radius: 3px;
  margin-left: auto;
  font-size: 12px;
}

/* Statistics */
.statistics {
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.statistics h2 {
  font-size: 12px;
  text-transform: uppercase;
  color: #8f98a0;
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(0,0,0,0.2);
  border-radius: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #66c0f4;
}

.stat-label {
  font-size: 11px;
  color: #8f98a0;
  margin-top: 4px;
}

/* Actions */
.actions {
  padding: 16px;
  display: flex;
  gap: 8px;
}

.btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 3px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-secondary {
  background: #4c5c70;
  color: #ffffff;
}

.btn-secondary:hover {
  background: #5c6c80;
}

/* Footer */
.popup-footer {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  background: rgba(0,0,0,0.3);
}

.popup-footer a {
  color: #66c0f4;
  text-decoration: none;
  margin: 0 8px;
}

.popup-footer a:hover {
  text-decoration: underline;
}
```

### Task 3: Popup Script
```typescript
// src/popup/popup.ts
class PopupController {
  constructor() {
    this.initializeUI();
    this.loadSettings();
    this.loadStatistics();
    this.attachEventListeners();
  }

  async initializeUI() {
    // Set version
    const manifest = chrome.runtime.getManifest();
    const versionElement = document.querySelector('.version');
    if (versionElement) {
      versionElement.textContent = `v${manifest.version}`;
    }
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      'enabled',
      'cacheEnabled',
      'cacheDuration',
      'displayPosition',
      'theme'
    ]);

    // Update UI with settings
    this.setCheckbox('enabled', settings.enabled !== false);
    this.setCheckbox('cache-enabled', settings.cacheEnabled !== false);
    this.setSelect('cache-duration', settings.cacheDuration || '7');
    this.setSelect('display-position', settings.displayPosition || 'above-purchase');
    this.setSelect('theme', settings.theme || 'auto');
  }

  async loadStatistics() {
    // Request database info from background
    const dbResponse = await chrome.runtime.sendMessage({ action: 'getDatabaseInfo' });

    if (dbResponse?.success && dbResponse.data) {
      const db = dbResponse.data;

      this.updateStat('db-version', db.version || '1.0.0');
      this.updateStat('db-games', db.gameCount || 100);
    }

    // Request match statistics
    const matchResponse = await chrome.runtime.sendMessage({ action: 'getMatchStats' });

    if (matchResponse?.success && matchResponse.data) {
      const stats = matchResponse.data;

      this.updateStat('matches-count', stats.totalMatches || 0);
      this.updateStat('match-rate', `${Math.round(stats.matchRate * 100 || 0)}%`);
    }
  }

  attachEventListeners() {
    // Main toggle
    document.getElementById('enabled')?.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      chrome.storage.local.set({ enabled });
      this.updateIcon(enabled);
    });

    // Settings
    document.getElementById('cache-enabled')?.addEventListener('change', (e) => {
      chrome.storage.local.set({
        cacheEnabled: (e.target as HTMLInputElement).checked
      });
    });

    document.getElementById('cache-duration')?.addEventListener('change', (e) => {
      chrome.storage.local.set({
        cacheDuration: (e.target as HTMLSelectElement).value
      });
    });

    document.getElementById('display-position')?.addEventListener('change', (e) => {
      chrome.storage.local.set({
        displayPosition: (e.target as HTMLSelectElement).value
      });
    });

    document.getElementById('theme')?.addEventListener('change', (e) => {
      chrome.storage.local.set({
        theme: (e.target as HTMLSelectElement).value
      });
    });

    // Actions
    document.getElementById('clear-cache')?.addEventListener('click', async () => {
      const button = document.getElementById('clear-cache') as HTMLButtonElement;
      button.textContent = 'Clearing...';
      button.disabled = true;

      await chrome.runtime.sendMessage({ action: 'clearCache' });

      button.textContent = 'Cache Cleared!';
      setTimeout(() => {
        button.textContent = 'Clear Cache';
        button.disabled = false;
        this.loadStatistics(); // Refresh stats
      }, 2000);
    });

    document.getElementById('refresh-current')?.addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.reload(tabs[0].id);
        window.close();
      }
    });

    // Footer links
    document.getElementById('report-issue')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({
        url: 'https://github.com/yourusername/hltb-steam/issues/new'
      });
    });

    document.getElementById('donate')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({
        url: 'https://www.buymeacoffee.com/yourusername'
      });
    });
  }

  private setCheckbox(id: string, checked: boolean) {
    const element = document.getElementById(id) as HTMLInputElement;
    if (element) element.checked = checked;
  }

  private setSelect(id: string, value: string) {
    const element = document.getElementById(id) as HTMLSelectElement;
    if (element) element.value = value;
  }

  private updateStat(id: string, value: string | number) {
    const element = document.getElementById(id);
    if (element) element.textContent = value.toString();
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  }

  private updateIcon(enabled: boolean) {
    const path = enabled ? {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    } : {
      '16': 'icons/icon16-disabled.png',
      '48': 'icons/icon48-disabled.png',
      '128': 'icons/icon128-disabled.png'
    };

    chrome.action.setIcon({ path });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
```

## Validation Checklist
- [ ] Popup opens quickly
- [ ] Settings persist
- [ ] Statistics display
- [ ] Actions work
- [ ] Theme switching
- [ ] Responsive layout
- [ ] Keyboard accessible
- [ ] No console errors
- [ ] Icon updates
- [ ] Links work

---

## Confidence Score: 9/10
Very high confidence - popup interfaces are straightforward with clear Chrome Extension APIs.