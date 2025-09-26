# Source Code Context

## Architecture Decisions

### Background Service Worker (background.js)
- **Event-driven**: Terminates after 30s of inactivity (MV3 requirement)
- **Message Handling**: Centralized switch statement for all actions
- **Cache Management**: 7-day expiration with Chrome alarms for cleanup
- **Security**: Input validation for all message parameters
- **Error Handling**: Graceful degradation with user-friendly error messages

### Content Script (content.js)
- **Steam Detection**: URL matching for game pages
- **Game Info Extraction**: App ID from URL, title from meta tags
- **DOM Injection**: Safe element creation without innerHTML
- **SPA Navigation**: MutationObserver for Steam's dynamic routing
- **XSS Prevention**: All user data sanitized before display

### Popup Interface (popup.html/js)
- **Real-time Settings**: Immediate storage updates
- **User Feedback**: Status messages for actions
- **Compact Design**: 350px width optimized for extension popup
- **Accessibility**: Proper labels and focus management

## Development Patterns

### Message Passing
```javascript
// Content → Background
const response = await chrome.runtime.sendMessage({
  action: 'fetchHLTB',
  gameTitle: gameInfo.title,
  appId: gameInfo.appId
});
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