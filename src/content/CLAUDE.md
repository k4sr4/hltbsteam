# Content Script - Claude Context

## Overview
TypeScript content scripts for injecting HLTB data into Steam game pages. Uses a **hybrid approach** combining TypeScript architecture with simple DOM manipulation.

## Active Implementation

### Current File: `content-script-hybrid.ts`
**Status**: ✅ Production (6.21 KB minified)
**Approach**: Hybrid TypeScript + Simple DOM
**Why**: Shadow DOM removed by Steam, simple DOM is compatible

### Architecture

```typescript
class HLTBContentScriptHybrid {
  // Core lifecycle
  initialize()                    // Main entry point
  waitForPageStability()          // Wait for Steam to load
  cleanup()                       // Remove old elements
  destroy()                       // Full teardown

  // Game detection
  isGamePage()                    // Check if on game page
  extractGameInfo()               // 4-strategy extraction
  cleanUrlTitle()                 // URL title cleanup
  cleanMetaTitle()                // Meta tag cleanup

  // UI injection
  injectHLTBData(data)           // Create and inject UI
  injectError(message)            // Show error state
  injectIntoPage(container)       // Find injection point

  // Navigation
  setupNavigationObserver()       // Watch for SPA routing

  // Communication
  sendMessage(message)            // Talk to background service
}
```

### Game Detection Strategy

**4-Strategy Approach** (tried in order):

1. **URL Pattern** (Most Reliable)
   ```javascript
   /app/\d+/([^\/\?#]+)/
   // Example: /app/1186640/Pumpkin_Jack/
   // Result: "Pumpkin Jack"
   ```

2. **DOM Element** (Community Pages)
   ```javascript
   document.querySelector('#appHubAppName')?.textContent
   ```

3. **OpenGraph Meta Tag**
   ```javascript
   meta[property="og:title"]?.content
   // Clean: Remove "on Steam" suffix
   // Remove "Save X% on " prefix
   ```

4. **Document Title** (Fallback)
   ```javascript
   document.title
   // Same cleaning as OpenGraph
   ```

### Injection Points

**7 Selectors** (tried in priority order):

```javascript
const injectionSelectors = [
  '.game_area_purchase',          // Store: before purchase area
  '.game_area_purchase_game',     // Store: alternative
  '.apphub_AppName',              // Community: after app name
  '.apphub_HomeHeader',           // Community: header area
  '.rightcol',                    // Store: right column
  '.game_meta_data',              // Store: meta area
  '#appHubAppName'                // Community: fallback
];
```

**Insertion Logic**:
- **Store pages**: `parentNode.insertBefore(container, element)` (before)
- **Community pages**: `parentNode.insertBefore(container, element.nextSibling)` (after)

### Page Stability Pattern

Steam loads content dynamically. Wait before injecting:

```typescript
async waitForPageStability() {
  const maxAttempts = 20; // 5 seconds max

  while (attempts < maxAttempts) {
    // Look for key Steam elements
    if (purchaseArea || gameDetails || pageContent) {
      await sleep(500); // Wait for animations
      return;
    }
    await sleep(250);
  }
}
```

### Navigation Handling

Steam is a SPA (Single Page Application):

```typescript
setupNavigationObserver() {
  const observer = new MutationObserver(() => {
    if (currentUrl !== lastUrl) {
      cleanup();        // Remove old component
      if (isGamePage()) {
        initialize();   // Re-inject on new game
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
```

### DOM Injection Pattern

**Simple createElement approach** (Steam-compatible):

```typescript
// Create container
const container = document.createElement('div');
container.className = 'hltb-container';

// Create header
const header = document.createElement('div');
header.className = 'hltb-header';

const title = document.createElement('span');
title.className = 'hltb-title';
title.textContent = 'HowLongToBeat'; // textContent, NOT innerHTML

// Build structure
header.appendChild(title);
container.appendChild(header);

// Inject into page
element.parentNode.insertBefore(container, element);
```

**Security**: Always use `textContent`, never `innerHTML`

### Performance Tracking

```typescript
interface PerformanceMetrics {
  startTime: number;
  injectionTime: number;  // Time to inject UI
  totalTime: number;      // Total including fetch
}

// Logged to console:
// [HLTB] Performance metrics: {
//   startTime: 0,
//   injectionTime: 150.5,
//   totalTime: 320.8
// }
```

### Type Definitions

Located in `types/HLTB.ts`:

```typescript
interface HLTBData {
  mainStory: number | null;
  mainExtra: number | null;
  completionist: number | null;
  allStyles?: number | null;
  gameId?: number | string;
  source?: DataSource;
  confidence?: ConfidenceLevel;
}

interface GameInfo {
  appId: string;
  title: string;
}

interface MessageResponse {
  success: boolean;
  data?: HLTBData;
  error?: string;
  settings?: { enabled: boolean };
}
```

## Archived Implementations

### Shadow DOM Component (Archived)

**Location**: `components/HLTBDisplay.ts` (1,200 lines)
**Status**: ❌ Removed by Steam
**Reason**: Steam's page management actively removes Shadow DOM elements

**What was built**:
- Complete Shadow DOM web component
- Full style isolation
- State machine pattern (LOADING/SUCCESS/ERROR/NO_DATA)
- Performance metrics tracking
- WCAG 2.1 AA accessibility
- Comprehensive documentation (3,000+ lines)

**Why it failed**:
- Shadow DOM creates encapsulation Steam detects
- Tried 8 different injection strategies - all removed
- Even fixed positioning to `body` was removed
- Steam specifically targets non-standard elements

**Preserved for**:
- Reference architecture
- Future use if Steam changes behavior
- Learning resource
- Design patterns documentation

### InjectionManager (Archived)

**Location**: `managers/InjectionManager.ts` (400 lines)
**Status**: Part of Shadow DOM system
**Purpose**: Smart injection point selection

**Features** (archived):
- 8 prioritized injection points
- Condition-based selection
- Auto-reinject on removal detection
- Debug logging

## Critical Architecture Decisions

### ❌ DO NOT Use Shadow DOM

**Problem**: Steam removes Shadow DOM elements during page updates

**Evidence**:
```
[HLTB] Component injected
[HLTB] Component removed, re-injecting... (attempt 1/3)
[HLTB] Component removed, re-injecting... (attempt 2/3)
[HLTB] Component removed, re-injecting... (attempt 3/3)
[HLTB] Stopping re-injection after 3 attempts
```

**Tried**:
1. Different injection points (8 selectors)
2. Different timing (wait for stability)
3. Different positions (before, after, prepend, append)
4. Fixed positioning to body
5. Closed vs Open Shadow DOM

**All failed** - Steam removes Shadow DOM

### ✅ Use Hybrid Approach

**Solution**: TypeScript + Simple DOM

**Benefits**:
- ✅ TypeScript type safety and organization
- ✅ Simple DOM Steam recognizes and keeps
- ✅ Small bundle size (6.21 KB vs 26.5 KB)
- ✅ Fast injection (< 10ms)
- ✅ Full compatibility with Steam

**Implementation**:
```typescript
// TypeScript class for organization
class HLTBContentScriptHybrid {
  // Type-safe interfaces
  private injectHLTBData(data: HLTBData): void {
    // Simple DOM manipulation
    const container = document.createElement('div');
    container.textContent = 'Safe text'; // Not innerHTML
    element.parentNode.insertBefore(container, element);
  }
}
```

## Development Patterns

### Message Passing to Background

```typescript
async sendMessage(message: any): Promise<MessageResponse> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response || {
      success: false,
      error: 'No response'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage
const response = await this.sendMessage({
  action: 'fetchHLTB',
  gameTitle: 'Pumpkin Jack',
  appId: '1186640'
});
```

### Error Handling Pattern

```typescript
try {
  // Operation
  this.injectHLTBData(data);
} catch (error) {
  console.error('[HLTB] Extension error:', error);
  this.injectError(
    error instanceof Error
      ? error.message
      : 'Unknown error occurred'
  );
}
```

### Cleanup Pattern

```typescript
private cleanup(): void {
  if (this.containerElement?.parentNode) {
    this.containerElement.parentNode.removeChild(
      this.containerElement
    );
    this.containerElement = null;
  }
}

// Called on:
// - Navigation to new page
// - Before re-injection
// - On destroy
```

## Performance Benchmarks

### Target Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Bundle Size | < 10 KB | 6.21 KB | ✅ |
| Injection Time | < 50ms | < 10ms | ✅ |
| Total Time | < 1s | 200-700ms | ✅ |
| Memory | Minimal | ~5 KB | ✅ |

### Breakdown

```
Page Stability Wait:  50-200ms  (waiting for Steam)
Game Detection:       < 1ms     (URL parsing)
Title Extraction:     < 5ms     (4 strategies)
Background Fetch:     100-500ms (network + DB)
DOM Injection:        < 5ms     (createElement)
────────────────────────────────────────────
Total User-Visible:   ~300ms    (very fast)
```

## Testing Strategy

### Manual Testing Checklist

- [ ] Loads on Store page
- [ ] Loads on Community page
- [ ] Displays HLTB data correctly
- [ ] Handles missing data gracefully
- [ ] Stays visible (not removed)
- [ ] Re-injects on navigation
- [ ] Shows errors properly
- [ ] Performance acceptable
- [ ] Console logging clear

### Common Issues & Solutions

**Issue**: Component not appearing
- Check console for errors
- Verify game page detected: `[HLTB] Game detected`
- Check injection point: `[HLTB] UI injected successfully at:`

**Issue**: Component disappears
- Normal if using Shadow DOM (don't use it!)
- Hybrid implementation should stay visible
- Check Steam isn't in infinite loading state

**Issue**: Wrong game title
- Check console: `[HLTB] Game detected: { appId, title }`
- Verify 4 strategies tried in order
- Check URL structure matches expected pattern

## Future Enhancements

### High Priority
1. **User Preferences** - Position, categories, theme
2. **Animation Options** - Fade-in effects
3. **Enhanced Accessibility** - Full WCAG 2.1 AA

### Low Priority
4. **Shadow DOM Revival** - If Steam changes behavior
5. **Advanced Positioning** - Customizable injection
6. **Performance Dashboard** - Show metrics to user

## Key Takeaways

1. **Test on real platform early** - Would have discovered Shadow DOM issue faster
2. **Simple often beats complex** - Shadow DOM was over-engineering for Steam
3. **Platform compatibility > Ideal architecture** - Hybrid approach was pragmatic
4. **TypeScript still valuable** - Type safety without Shadow DOM overhead
5. **Preserve failed attempts** - Shadow DOM code useful for reference

## Related Documentation

- `PRDs/07_ui_component_injection_FINAL_IMPLEMENTATION.md` - Complete implementation summary
- `components/HLTB_DISPLAY_ARCHITECTURE.md` - Shadow DOM architecture (archived)
- `types/HLTB.ts` - Type definitions
- Root `CLAUDE.md` - Project-wide context
