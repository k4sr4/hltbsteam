# HLTB Steam Extension Test Suite

A comprehensive test suite for the Chrome extension that displays HowLongToBeat completion times on Steam pages.

## Overview

This test suite provides thorough coverage of all extension components with practical, runnable tests that properly mock Chrome APIs. The tests are organized into multiple layers following testing best practices.

## Test Structure

### Core Test Files

#### `setup.js`
- Global test configuration and Chrome API mocks
- Mock implementations for `chrome.runtime`, `chrome.storage`, `chrome.alarms`
- DOM and browser API mocks for content script testing
- Helper utilities and mock reset functions

#### `background.test.js`
Tests for the service worker (`background.js`):
- ✅ Message handling (fetchHLTB, getSettings, clearCache)
- ✅ Cache management (storing, retrieving, expiration logic)
- ✅ Settings management and default values
- ✅ Extension installation and setup
- ✅ Periodic cache cleanup via alarms
- ✅ Error handling for storage and network failures

#### `content.test.js`
Tests for the content script (`content.js`):
- ✅ Game page detection (Steam store and community pages)
- ✅ Game info extraction (app ID, title from DOM)
- ✅ HLTB data injection and DOM manipulation
- ✅ Dynamic navigation handling (SPA behavior)
- ✅ Extension enable/disable state management
- ✅ Error handling and graceful degradation

#### `message-passing.test.js`
Tests for communication between components:
- ✅ Content script to background messaging patterns
- ✅ Async response handling and timeouts
- ✅ Message validation and sanitization
- ✅ Connection state management
- ✅ Error recovery and retry mechanisms
- ✅ Performance monitoring and success rates

#### `storage.test.js`
Tests for Chrome storage operations:
- ✅ Settings persistence (local and sync storage)
- ✅ Cache storage with timestamps and metadata
- ✅ Storage quota management and limits
- ✅ Data migration between extension versions
- ✅ Concurrent operation handling
- ✅ Storage corruption detection and recovery

#### `cache-management.test.js`
Advanced cache management functionality:
- ✅ Cache entry lifecycle and validation
- ✅ Expiration policies and cleanup strategies
- ✅ LRU (Least Recently Used) eviction
- ✅ Storage usage optimization
- ✅ Cache statistics and performance metrics
- ✅ Integrity validation and corruption repair

#### `integration.test.js`
End-to-end integration tests:
- ✅ Complete user workflows (first visit, return visits)
- ✅ Cross-component communication flows
- ✅ Error propagation and recovery
- ✅ Performance under concurrent load
- ✅ Dynamic navigation between Steam pages
- ✅ Settings changes affecting all components

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install
```

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run Specific Test Files
```bash
npm test -- background.test.js
npm test -- --testNamePattern="Cache Management"
```

### Run in Watch Mode
```bash
npm test -- --watch
```

## Test Coverage Goals

The test suite aims for:
- **90%+ Statement Coverage** - All code paths exercised
- **85%+ Branch Coverage** - All conditional logic tested
- **80%+ Function Coverage** - All functions have test cases
- **100% Critical Path Coverage** - Core workflows fully tested

## Key Testing Patterns

### Chrome API Mocking
```javascript
// All Chrome APIs are properly mocked in setup.js
chrome.runtime.sendMessage.mockResolvedValue({ success: true });
chrome.storage.local.get.mockResolvedValue({ cached: 'data' });
```

### Async Testing
```javascript
// Proper async/await patterns for Chrome extension promises
test('should handle async operations', async () => {
  const result = await chrome.runtime.sendMessage({ action: 'test' });
  expect(result.success).toBe(true);
});
```

### DOM Testing
```javascript
// Mock DOM elements for content script testing
global.document.querySelector.mockReturnValue({
  content: 'Portal 2'
});
```

### Error Scenarios
```javascript
// Test error conditions and recovery
chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
await expect(operation()).rejects.toThrow('Storage error');
```

## Test Data Management

### Mock Data Structure
```javascript
const mockCacheEntry = {
  data: {
    mainStory: '8 Hours',
    mainExtra: '16 Hours',
    completionist: '32 Hours'
  },
  timestamp: Date.now(),
  gameTitle: 'Portal 2',
  version: '1.0'
};
```

### Settings Mock
```javascript
const mockSettings = {
  enabled: true,
  cacheEnabled: true,
  theme: 'auto'
};
```

## Performance Testing

The test suite includes performance benchmarks:
- Message passing round-trip times
- Cache lookup performance
- DOM injection speed
- Memory usage patterns
- Storage operation efficiency

## Browser Compatibility

Tests are designed to work across Chrome extension environments:
- Manifest V3 service workers
- Content script contexts
- Extension popup environments
- Chrome storage APIs

## Debugging Tests

### Enable Debug Output
```bash
npm test -- --verbose
```

### Run Single Test with Debugging
```javascript
test.only('should debug this test', () => {
  console.log('Debug information');
  // Test implementation
});
```

### Mock Inspection
```javascript
// Check what mocks were called
expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
  action: 'fetchHLTB',
  gameTitle: 'Portal 2',
  appId: '620'
});
```

## Contributing to Tests

### Adding New Tests
1. Follow existing file structure and naming conventions
2. Include both happy path and error scenarios
3. Add performance considerations where applicable
4. Update this README with new test descriptions

### Test Naming Convention
```javascript
describe('Component Name', () => {
  describe('Feature Category', () => {
    test('should do specific behavior under specific condition', () => {
      // Test implementation
    });
  });
});
```

### Mock Guidelines
- Reset all mocks in `beforeEach` blocks
- Use `global.resetChromeMocks()` helper
- Create realistic mock responses
- Test both success and failure paths

## Common Issues and Solutions

### Test Isolation
```javascript
beforeEach(() => {
  global.resetChromeMocks();
  delete require.cache[require.resolve('../content.js')];
});
```

### Async Test Timing
```javascript
// Allow async operations to complete
await new Promise(resolve => setTimeout(resolve, 0));
```

### Mock Function Verification
```javascript
// Verify mocks were called correctly
expect(mockFunction).toHaveBeenCalledTimes(1);
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
```

## Future Enhancements

Planned test improvements:
- Visual regression testing for UI components
- Load testing for cache management
- Security testing for message validation
- Accessibility testing for injected UI
- Cross-browser compatibility testing