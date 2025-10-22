# Source Code Context

## Architecture Decisions

### Background Service Worker (background.js)
- **Event-driven**: Terminates after 30s of inactivity (MV3 requirement)
- **Message Handling**: Centralized switch statement for all actions
- **Cache Management**: 7-day expiration with Chrome alarms for cleanup
- **Security**: Input validation for all message parameters
- **Error Handling**: Graceful degradation with user-friendly error messages

### Content Script (content.js)
- **Steam Detection**: URL matching for game pages (Store and Community)
- **Game Info Extraction**: App ID from URL, title from meta tags
- **DOM Injection**: Safe element creation without innerHTML
- **Multiple Injection Points**: Fallback selectors for Store/Community pages
- **SPA Navigation**: MutationObserver for Steam's dynamic routing
- **XSS Prevention**: All user data sanitized before display

### Enhanced Detection System (TypeScript - src/content/)
- **6-Strategy Title Extraction**: OpenGraph → AppName → JSON-LD → Breadcrumb → PageTitle → Fallback
- **Performance Optimized**: <10ms detection target with caching
- **Advanced Navigation Observer**: Debounced mutations, selective monitoring
- **State Management**: Comprehensive navigation and detection state tracking
- **Security Hardened**: Prototype pollution protection in JSON parsing
- **Status**: Architecture complete, compilation issues need resolution

### Popup Interface (popup.ts/html/css - PRD 08)
- **Architecture**: Single PopupController class with TypeScript type safety
- **Bundle Size**: 6.96 KB minified (target: < 100ms load time)
- **Initialization**: Parallel data loading (Promise.all) for settings + statistics
- **Element Caching**: Map-based caching of 15+ DOM elements for performance
- **Real-time Settings**: Immediate chrome.storage.local updates
- **Statistics Display**: Database info and match stats from background service
- **User Feedback**: Toast messages with success/error/info states and animations
- **Compact Design**: 350px width standard for Chrome extension popups
- **Accessibility**: WCAG 2.1 AA compliant with ARIA labels, keyboard navigation, screen reader support
- **Styling**: Steam-themed with CSS custom properties (design tokens)
- **Actions**: Clear cache (with button states), refresh page (with Steam validation)
- **Links**: GitHub, report issue, suggest game (contribution workflow)

## Development Patterns

### Message Passing
```javascript
// Content → Background
const response = await chrome.runtime.sendMessage({
  action: 'fetchHLTB',
  gameTitle: gameInfo.title,
  appId: gameInfo.appId
});

// Popup → Background (multiple message types)
const dbInfo = await chrome.runtime.sendMessage({ action: 'getDatabaseInfo' });
const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
const clearResult = await chrome.runtime.sendMessage({ action: 'clearCache' });
```

### Safe DOM Manipulation
```javascript
// NEVER use innerHTML - XSS risk
// element.innerHTML = userContent; // ❌

// ALWAYS use textContent/createElement
element.textContent = sanitizedContent; // ✅
```

### Storage Patterns
```javascript
// Cache with expiration
const cacheKey = `hltb_${sanitizedAppId}`;
await chrome.storage.local.set({
  [cacheKey]: {
    data: validatedData,
    timestamp: Date.now(),
    gameTitle: gameTitle.substring(0, 100)
  }
});
```

### Error Handling
```javascript
// Always provide fallback responses
try {
  // operation
  sendResponse({ success: true, data: result });
} catch (error) {
  console.error('[HLTB] Error:', error);
  sendResponse({ success: false, error: 'User-friendly message' });
}
```

## Security Considerations

### Input Validation
- App IDs: Must be numeric strings only
- Game titles: Length limited, HTML entities escaped
- Cache keys: Sanitized to prevent storage pollution
- Time strings: Regex validated for safe characters only

### Content Security Policy
- No inline scripts allowed
- No eval() or new Function()
- All resources bundled with extension
- External requests only to approved hosts

### Permission Minimization
- Only `storage` and `alarms` permissions requested
- Host permissions limited to Steam and HLTB domains
- No broad host permissions like `<all_urls>`

## Critical Bug Fixes & Lessons

### MutationObserver Options Bug
- **Issue**: MutationObserver requires options in `observe()` method, not constructor
- **Error**: "The options object must set at least one of 'attributes', 'characterData', or 'childList' to true"
- **Fix**: Pass options to `observer.observe(target, options)` not to constructor

### Injection Point Compatibility
- **Store Pages**: Use `.game_area_purchase` selector, inject BEFORE element
- **Community Pages**: Use `.apphub_AppName` selector, inject AFTER element
- **Solution**: Multiple fallback selectors with page-specific insertion logic

### TypeScript Build Issues
- **Problem**: tsconfig.json rootDir conflicts with test files location
- **Workaround**: Fallback to JavaScript content.js when TypeScript fails
- **Fix Needed**: Separate tsconfig for tests vs source compilation

## Performance Optimizations

### Caching Strategy
- 7-day cache duration balances freshness vs performance
- Automatic cleanup prevents storage bloat
- Cache keys include app ID for efficient lookup
- Failed requests don't pollute cache

### Lazy Loading
- Content script only initializes on game pages
- Background worker remains dormant until needed
- Popup loads settings on demand

### Memory Management
- No global variables in content script
- Event listeners properly cleaned up
- MutationObserver with specific target scope
- Popup controller uses element caching (Map) to avoid repeated DOM queries

## Popup Interface Implementation Details

### Architecture Pattern
```typescript
class PopupController {
  private elements: Map<string, HTMLElement>  // Cached DOM elements

  async initialize() {
    // Parallel initialization for speed
    await Promise.all([
      this.initializeUI(),      // Set version, theme
      this.loadSettings(),       // From chrome.storage.local
      this.loadStatistics()      // From background messages
    ]);
    this.attachEventListeners();
  }
}
```

### Performance Optimizations
1. **Element Caching**: Cache all 15+ DOM elements in Map during initialization
2. **Parallel Loading**: Use Promise.all for independent async operations
3. **Minimal Bundle**: 6.96 KB minified (TypeScript → Webpack → Terser)
4. **No Blocking**: All storage/message operations are async
5. **Efficient Updates**: Only update changed elements, not entire UI

### Button State Management
```typescript
// Clear cache button has 4 states: idle → processing → success/error → idle
setButtonState(button, 'processing');  // Shows spinner, disables button
setButtonState(button, 'success');     // Green background, "Cache Cleared!"
setButtonState(button, 'error');       // Red background, "Failed"
// Auto-resets to idle after 2 seconds
```

### Feedback System
```typescript
showFeedback(message: string, type: 'success' | 'error' | 'info', duration = 3000)
// Creates toast message with:
// - Appropriate color/styling
// - ARIA live region for screen readers
// - Slide-in animation
// - Auto-dismiss after duration
// - Smooth slide-out removal
```

### Settings Persistence Pattern
```typescript
// All settings stored in chrome.storage.local with defaults
const DEFAULT_SETTINGS = {
  enabled: true,
  cacheEnabled: true,
  cacheDuration: 7,
  displayPosition: 'above-purchase',
  theme: 'auto'
};

// Load with fallback to defaults
const settings = await chrome.storage.local.get(['enabled', ...]);
const enabled = settings.enabled !== false;  // Default to true if missing
```

### Statistics Calculation
```typescript
// Match rate calculation from background stats
const total = stats.totalRequests || 0;
const successes = (stats.apiSuccesses || 0) +
                  (stats.scraperSuccesses || 0) +
                  (stats.fallbackSuccesses || 0);
const matchRate = total > 0 ? successes / total : 0;
// Display as percentage: Math.round(matchRate * 100) + '%'
```

### Background Message Handlers (message-handler.ts)
```typescript
case 'getDatabaseInfo':
  // Import fallback-data.json to get database metadata
  const fallbackData = await import('./services/fallback-data.json');
  return {
    success: true,
    data: {
      version: fallbackData.version,
      gameCount: fallbackData.games.length,
      lastUpdated: fallbackData.lastUpdated
    }
  };

case 'getStats':
  // Return statistics from integrated service
  return { success: true, data: this.hltbService.getStats() };

case 'clearCache':
  // Clear cache and return count
  const cleared = await this.hltbService.clearCache();
  return { success: true, cleared };
```

### Accessibility Implementation
- **ARIA Labels**: All interactive elements have `aria-label` or `aria-labelledby`
- **ARIA Descriptions**: Settings have `aria-describedby` linking to description text
- **Live Regions**: Feedback messages use `role="status"` and `aria-live="polite"`
- **Screen Reader Text**: `.sr-only` class for headings that provide structure
- **Keyboard Navigation**: All controls reachable with Tab, focus-visible styles
- **Semantic HTML**: Proper use of button, label, select, section, nav elements

### CSS Design System
```css
:root {
  /* Steam-inspired color palette */
  --color-bg-primary: #1b2838;
  --color-accent-primary: #66c0f4;
  --color-success: #5cbf60;
  --color-error: #f47b66;

  /* Spacing system (4px base) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;

  /* Typography scale */
  --font-size-sm: 11px;
  --font-size-base: 13px;
  --font-size-lg: 16px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
}
```

### Testing Strategy (Designed, Not Implemented)
- **70+ Test Scenarios**: Unit, integration, UI, accessibility
- **Test Distribution**: 65% unit, 25% integration, 8% UI, 2% accessibility
- **Coverage Target**: 95% code coverage, 100% critical path
- **Mock Strategy**: Complete Chrome API mocks (storage, runtime, tabs, action)
- **CI/CD Integration**: Automated testing with quality gates
- **Performance Benchmarks**: < 100ms initialization, < 50ms setting changes

### Common Pitfalls & Solutions
1. **Pitfall**: Forgetting to cache DOM elements leads to repeated queries
   **Solution**: Cache all elements in Map during initialization

2. **Pitfall**: Sequential async operations slow down initialization
   **Solution**: Use Promise.all for independent operations

3. **Pitfall**: Button clicks during processing cause race conditions
   **Solution**: Disable button during processing, manage state explicitly

4. **Pitfall**: Background service worker may be inactive
   **Solution**: Always handle message timeouts and errors gracefully

5. **Pitfall**: Settings changes not persisting
   **Solution**: Always await chrome.storage.local.set() and verify success

### File Locations
- **Controller**: `C:\hltbsteam\popup.ts` (498 lines)
- **HTML**: `C:\hltbsteam\popup.html` (199 lines)
- **CSS**: `C:\hltbsteam\popup.css` (543 lines)
- **Background Handler**: `C:\hltbsteam\src\background\message-handler.ts` (getDatabaseInfo added)
- **Webpack Config**: Entry point changed to `./popup.ts`
- **Built Output**: `dist/popup.js` (6.96 KB), `dist/popup.html`, `dist/popup.css`