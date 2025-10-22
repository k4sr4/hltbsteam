# CRITICAL Security Fixes Required - HLTB Steam Extension

## Status: DO NOT PUBLISH - Security Issues Found

### Summary
3 CRITICAL/HIGH severity vulnerabilities must be fixed before production deployment.

---

## 1. CRITICAL: Remove innerHTML Usage in HLTBDisplay.ts

**File:** `C:\hltbsteam\src\content\components\HLTBDisplay.ts`
**Line:** 602

**Current Code:**
```typescript
private performRender(): void {
  if (!this.containerElement) return;

  // Clear container
  this.containerElement.innerHTML = '';  // ❌ SECURITY VIOLATION
  // ...
}
```

**Fixed Code:**
```typescript
private performRender(): void {
  if (!this.containerElement) return;

  // Clear container safely without innerHTML
  while (this.containerElement.firstChild) {
    this.containerElement.removeChild(this.containerElement.firstChild);
  }
  this.metrics.domOperations += 1;

  // ... rest of render logic
}
```

---

## 2. CRITICAL: Remove Google Fonts CDN Import

**File:** `C:\hltbsteam\src\content\components\HLTBDisplay.ts`
**Line:** 1032

**Current Code:**
```typescript
private generateStyles(): string {
  return `
    /* Font import for consistency with Steam */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');  // ❌ CSP VIOLATION

    .hltb-container {
      font-family: "Motiva Sans", "Inter", -apple-system, ...
    }
  `;
}
```

**Fixed Code:**
```typescript
private generateStyles(): string {
  return `
    /* Use system fonts only - no external CDN */
    .hltb-container {
      font-family: "Motiva Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      /* Removed Inter from Google Fonts */
      // ... rest of styles
    }
  `;
}
```

**Why This Matters:**
- Violates Content Security Policy
- Privacy leak to Google (tracks users)
- External dependency that could fail or be compromised

---

## 3. HIGH: Add Sender Validation in Background Service

**File:** `C:\hltbsteam\background.js`
**Lines:** 4-24

**Current Code:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[HLTB] Received message:', request.action);
  // ❌ NO SENDER VALIDATION

  switch(request.action) {
    case 'fetchHLTB':
      handleFetchHLTB(request, sendResponse);
      return true;
    // ...
  }
});
```

**Fixed Code:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Validate sender
  if (!isValidSender(sender)) {
    console.warn('[HLTB Security] Rejected message from invalid sender:', sender);
    sendResponse({ success: false, error: 'Unauthorized' });
    return;
  }

  console.log('[HLTB] Received message:', request.action);

  switch(request.action) {
    case 'fetchHLTB':
      handleFetchHLTB(request, sendResponse);
      return true;
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

/**
 * Validates that message sender is authorized
 */
function isValidSender(sender) {
  // Verify sender is from this extension
  if (!sender || sender.id !== chrome.runtime.id) {
    return false;
  }

  // Verify sender is from allowed URL patterns (Steam pages)
  if (sender.url) {
    try {
      const senderOrigin = new URL(sender.url).origin;
      const allowedOrigins = [
        'https://store.steampowered.com',
        'https://steamcommunity.com'
      ];

      if (!allowedOrigins.includes(senderOrigin)) {
        return false;
      }
    } catch (error) {
      console.error('[HLTB Security] Invalid sender URL:', error);
      return false;
    }
  }

  // Verify sender is a content script (has tab info)
  if (!sender.tab) {
    return false;
  }

  return true;
}
```

---

## 4. MEDIUM: Validate gameId Before Creating Links

**File:** `C:\hltbsteam\src\content\components\HLTBDisplay.ts`
**Lines:** 919-932

**Current Code:**
```typescript
private createHLTBLink(gameId: number | string): HTMLElement {
  const link = document.createElement('a');
  link.className = 'hltb-link';
  link.href = `https://howlongtobeat.com/game/${gameId}`;  // ❌ NO VALIDATION
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'View on HowLongToBeat';
  // ...
  return link;
}
```

**Fixed Code:**
```typescript
/**
 * Validates and sanitizes HLTB game ID
 */
private validateGameId(gameId: number | string | undefined): string | null {
  if (gameId === null || gameId === undefined) {
    return null;
  }

  const gameIdStr = String(gameId);

  // Only allow alphanumeric and hyphens, max 20 chars
  const sanitizedId = gameIdStr.replace(/[^a-zA-Z0-9\-]/g, '').substring(0, 20);

  if (!sanitizedId || sanitizedId.length === 0) {
    console.warn('[HLTB Security] Invalid game ID rejected:', gameId);
    return null;
  }

  // HLTB IDs must contain at least one digit
  if (!/\d/.test(sanitizedId)) {
    console.warn('[HLTB Security] Game ID must contain digits:', sanitizedId);
    return null;
  }

  return sanitizedId;
}

/**
 * Creates a safe link to HLTB website
 */
private createHLTBLink(gameId: number | string): HTMLElement | null {
  const validatedId = this.validateGameId(gameId);

  if (!validatedId) {
    console.warn('[HLTB Security] Cannot create link with invalid game ID');
    return null;
  }

  const link = document.createElement('a');
  link.className = 'hltb-link';

  // Use URL constructor for safe URL building
  const hltbUrl = new URL(`https://howlongtobeat.com/game/${validatedId}`);
  link.href = hltbUrl.toString();

  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'View on HowLongToBeat';

  if (this.config.accessibility) {
    link.setAttribute('aria-label', 'View detailed completion times on HowLongToBeat website (opens in new tab)');
  }

  return link;
}
```

**Update renderSuccess() to handle null:**
```typescript
private renderSuccess(): void {
  if (!this.containerElement || !this.state.data) return;

  const data = this.state.data;

  const header = this.createHeader(data);
  this.containerElement.appendChild(header);
  this.metrics.domOperations += 1;

  const timesGrid = this.createTimesGrid(data);
  this.containerElement.appendChild(timesGrid);
  this.metrics.domOperations += 1;

  // Create link if enabled and valid
  if (this.config.enableLink && data.gameId) {
    const link = this.createHLTBLink(data.gameId);
    if (link) {  // ✅ Only append if validation passed
      this.containerElement.appendChild(link);
      this.metrics.domOperations += 1;
    }
  }
}
```

---

## 5. MEDIUM: Add Theme Color Validation

**File:** `C:\hltbsteam\src\content\components\HLTBDisplay.ts`
**Lines:** 965-981

**Add this new method:**
```typescript
/**
 * Validates CSS color value to prevent injection attacks
 */
private validateColor(color: string): string {
  // Only allow hex colors, rgb/rgba, and safe named colors
  const hexPattern = /^#[0-9A-Fa-f]{3,8}$/;
  const rgbPattern = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+)?\s*\)$/;
  const namedColors = ['red', 'blue', 'green', 'white', 'black', 'transparent', 'inherit', 'currentColor'];

  if (hexPattern.test(color) || rgbPattern.test(color) || namedColors.includes(color.toLowerCase())) {
    return color;
  }

  console.warn('[HLTB Security] Invalid color rejected:', color);
  return '#66c0f4'; // Return safe default
}
```

**Update mergeConfig():**
```typescript
private mergeConfig(userConfig: HLTBDisplayConfig): Required<HLTBDisplayConfig> {
  const merged = { ...HLTBDisplay.DEFAULT_CONFIG, ...userConfig };

  if (userConfig.theme) {
    merged.theme = {
      ...HLTBDisplay.DEFAULT_CONFIG.theme,
      ...userConfig.theme
    };

    // Validate and sanitize all color values
    if (userConfig.theme.colors) {
      const validatedColors: any = {};
      for (const [key, value] of Object.entries(userConfig.theme.colors)) {
        if (value) {
          validatedColors[key] = this.validateColor(value);  // ✅ Validate each color
        }
      }

      merged.theme.colors = {
        ...HLTBDisplay.DEFAULT_CONFIG.theme.colors,
        ...validatedColors
      };
    }
  }

  return merged;
}
```

---

## Testing Checklist

After implementing these fixes, verify:

- [ ] No `innerHTML` usage anywhere in the codebase
- [ ] No external CDN imports in styles
- [ ] All messages validate sender before processing
- [ ] All URLs validated before link creation
- [ ] All colors validated before style injection
- [ ] Console has no CSP warnings
- [ ] Extension works on both Steam Store and Community pages
- [ ] Component still renders correctly after security fixes

---

## Verification Commands

```bash
# Search for innerHTML usage
grep -r "innerHTML" src/

# Search for external URLs in code
grep -r "https://" src/ | grep -v "howlongtobeat.com" | grep -v "steampowered.com" | grep -v "steamcommunity.com"

# Search for eval or Function usage
grep -r "eval\|new Function" src/

# Build and test
npm run build
npm run test
```

---

## Timeline

**CRITICAL fixes (1-3):** Must be completed before ANY release
**MEDIUM fixes (4-5):** Should be completed before production release
**Testing:** Required after all fixes

**Estimated Time:** 2-3 hours for all fixes

---

## Security Review Status

- [x] Initial security review completed
- [ ] Critical fixes implemented
- [ ] Security test suite added
- [ ] Re-review after fixes
- [ ] Approved for production

**DO NOT PUBLISH TO CHROME WEB STORE UNTIL ALL CRITICAL FIXES ARE COMPLETED**
