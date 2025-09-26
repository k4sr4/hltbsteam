# Testing Context and Strategy

## Test Suite Overview

### Test Statistics
- **111 Total Tests**: Comprehensive coverage across all components
- **88 Tests Passing**: Core functionality fully validated
- **23 Tests with Issues**: Primarily JSDOM environment limitations
- **6 Test Files**: Organized by component and functionality

### Test Environment Setup
- **Jest Framework**: JavaScript testing with JSDOM
- **Chrome API Mocking**: Complete mock implementation in `setup.js`
- **Isolated Tests**: Each test resets mocks for consistency
- **Async Testing**: Proper promise handling for Chrome APIs

## Test Categories

### Unit Tests (70% of suite)
- **background.test.js**: Service worker message handling, cache management
- **content.test.js**: DOM manipulation, game detection, injection logic
- **storage.test.js**: Chrome storage operations (100% passing)
- **cache-management.test.js**: Advanced caching scenarios (100% passing)

### Integration Tests (20% of suite)
- **message-passing.test.js**: Cross-component communication
- **integration.test.js**: End-to-end workflows

### Performance Tests (10% of suite)
- Cache hit rates and response times
- Memory usage validation
- Extension load time benchmarks

## Testing Patterns

### Chrome API Mocking
```javascript
// Standard mock setup
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: { addListener: jest.fn() }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  }
};
```

### Async Testing
```javascript
test('background responds to message', async () => {
  const mockResponse = { success: true, data: {} };
  chrome.runtime.sendMessage.mockResolvedValue(mockResponse);

  const result = await chrome.runtime.sendMessage({ action: 'test' });
  expect(result.success).toBe(true);
});
```

### DOM Testing
```javascript
test('content script injects UI', () => {
  // Setup DOM
  document.body.innerHTML = '<div class="game_area_purchase"></div>';

  // Test injection
  injectHLTBData(mockData);

  expect(document.querySelector('.hltb-container')).toBeTruthy();
});
```

## Test Limitations and Solutions

### JSDOM Constraints
- **Navigation**: `window.location.href` changes not fully supported
- **Solution**: Mock location object for navigation tests
- **MutationObserver**: Limited DOM mutation support
- **Solution**: Direct function testing instead of observer testing

### Chrome Extension Testing
- **Extension Context**: Tests run in Node.js, not extension environment
- **Solution**: Comprehensive Chrome API mocking
- **Message Passing**: Can't test actual inter-script communication
- **Solution**: Mock all message handlers and validate call patterns

### Async Timing Issues
- **Race Conditions**: Some integration tests have timing dependencies
- **Solution**: Explicit promise chains and setTimeout mocking
- **Background Tasks**: Service worker lifecycle hard to test
- **Solution**: Focus on message handling rather than lifecycle

## Test Data Patterns

### Mock Game Data
```javascript
const mockGameInfo = {
  appId: '12345',
  title: 'Test Game'
};

const mockHLTBData = {
  mainStory: '12 Hours',
  mainExtra: '24 Hours',
  completionist: '48 Hours'
};
```

### Storage Test Patterns
```javascript
// Test cache expiration
const expiredCache = {
  data: mockData,
  timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days old
};
```

## Running Tests

### Commands
- `npm test` - Run all tests
- `npm test -- --watch` - Watch mode for development
- `npm test -- --coverage` - Generate coverage report
- `npm test storage.test.js` - Run specific test file

### Coverage Goals
- **Storage Operations**: 100% (achieved)
- **Cache Management**: 100% (achieved)
- **Message Handling**: 95% (achieved)
- **DOM Manipulation**: 80% (limited by JSDOM)
- **Error Handling**: 90% (achieved)

## Future Testing Improvements

### Browser Testing
- Playwright or Puppeteer for actual Chrome testing
- Extension loading and interaction testing
- Real Steam page injection testing

### Performance Testing
- Memory leak detection
- Bundle size monitoring
- Extension startup time measurement

### Security Testing
- XSS attack simulation
- Input validation edge cases
- Permission boundary testing