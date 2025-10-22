# HLTB Steam Extension - Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test HLTBDisplay.test.ts

# Run tests matching pattern
npm test -- -t "should render loading state"

# Run with coverage
npm test -- --coverage

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

## Table of Contents

1. [Overview](#overview)
2. [Test Infrastructure](#test-infrastructure)
3. [Writing Tests](#writing-tests)
4. [Test Organization](#test-organization)
5. [Common Patterns](#common-patterns)
6. [Debugging Tests](#debugging-tests)
7. [Best Practices](#best-practices)
8. [CI/CD Integration](#cicd-integration)

---

## Overview

### Test Statistics

- **Total Tests**: 127+
- **Unit Tests**: 90+ tests (~70%)
- **Integration Tests**: 25+ tests (~20%)
- **E2E Tests**: 12+ tests (~10%)

### Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| Line Coverage | >85% | TBD |
| Branch Coverage | >80% | TBD |
| Function Coverage | >90% | TBD |
| Critical Path | 100% | TBD |

### Test Framework

- **Jest** v29.6.0 - Test runner and assertion library
- **ts-jest** - TypeScript support
- **jsdom** - DOM environment for tests
- **Test Utils** - Custom helpers in `tests/test-utils/`

---

## Test Infrastructure

### Setup Files

**`tests/setup.js`** - Global test environment setup
- Chrome API mocks
- DOM mocks
- Performance API mocks
- Console mocks
- Custom matchers

**`tests/test-utils/`** - Testing utilities
- `factories.ts` - Mock data factories
- `dom-utils.ts` - DOM manipulation helpers
- `chrome-utils.ts` - Chrome API helpers
- `async-utils.ts` - Async operation helpers
- `assertion-utils.ts` - Custom assertions

### Jest Configuration

**`jest.config.ts`** - Main configuration
```typescript
{
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.{js,ts}']
}
```

---

## Writing Tests

### Test File Structure

```typescript
/**
 * Component Name - Unit Tests
 *
 * Description of what is being tested
 *
 * Coverage:
 * - Feature 1 (X tests)
 * - Feature 2 (Y tests)
 */

import { ComponentToTest } from '../../src/...';
import { helpers } from '../test-utils';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
    cleanupDOM();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    cleanupDOM();
  });

  describe('Feature Group', () => {
    test('should do something when condition', () => {
      // Arrange
      const input = createMockInput();

      // Act
      const result = doSomething(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Naming Conventions

**Test Files**: `[ComponentName].test.ts`

**Test Suites**: `describe('[ComponentName]', ...)`

**Test Cases**: `test('should [expected behavior] when [condition]', ...)`

**Examples**:
```typescript
describe('HLTBDisplay', () => {
  describe('State Management', () => {
    test('should transition to SUCCESS state when valid data is provided', () => {
      // ...
    });
  });
});
```

### Arrange-Act-Assert Pattern

Always structure tests with clear sections:

```typescript
test('should calculate total correctly', () => {
  // Arrange - Set up test data
  const items = [1, 2, 3];
  const calculator = new Calculator();

  // Act - Perform the action
  const result = calculator.sum(items);

  // Assert - Verify the result
  expect(result).toBe(6);
});
```

---

## Test Organization

### Directory Structure

```
tests/
├── setup.js                    # Global setup
├── test-utils/                 # Shared utilities
│   ├── factories.ts
│   ├── dom-utils.ts
│   ├── chrome-utils.ts
│   ├── async-utils.ts
│   └── assertion-utils.ts
├── fixtures/                   # Test data
│   └── hltb-data.json
├── unit/                       # Unit tests
│   ├── HLTBDisplay.test.ts
│   ├── InjectionManager.test.ts
│   └── content-script.test.ts
├── integration/                # Integration tests
│   └── component-interaction.test.ts
└── e2e/                        # End-to-end tests
    └── user-workflows.test.ts
```

### Test Categories

**Unit Tests** (`tests/unit/`)
- Test individual components in isolation
- Mock all dependencies
- Fast execution (<1s per file)
- Example: Testing HLTBDisplay state management

**Integration Tests** (`tests/integration/`)
- Test component interactions
- Minimal mocking
- Medium execution time (1-3s per file)
- Example: Testing InjectionManager + HLTBDisplay

**E2E Tests** (`tests/e2e/`)
- Test complete user workflows
- Full system integration
- Slower execution (3-5s per file)
- Example: Testing complete game page visit

---

## Common Patterns

### Creating Mock Data

```typescript
import { createMockHLTBData, createMockDisplayConfig } from '../test-utils';

// Create with defaults
const data = createMockHLTBData();

// Override specific fields
const customData = createMockHLTBData({
  mainStory: 10,
  source: 'cache'
});

// Create config
const config = createMockDisplayConfig({
  theme: { mode: 'light' }
});
```

### Setting Up DOM

```typescript
import { setupStorePageDOM, cleanupDOM } from '../test-utils';

beforeEach(() => {
  setupStorePageDOM();  // Creates Steam Store page structure
});

afterEach(() => {
  cleanupDOM();  // Removes all DOM elements
});
```

### Mocking Chrome APIs

```typescript
import { mockSendMessage, resetChromeMocks } from '../test-utils';

beforeEach(() => {
  resetChromeMocks();
});

test('should send message', async () => {
  const response = { success: true, data: mockData };
  mockSendMessage(response);

  const result = await chrome.runtime.sendMessage({ action: 'test' });

  expect(result).toEqual(response);
});
```

### Testing Async Operations

```typescript
import { waitFor, flushPromises } from '../test-utils';

test('should update after async operation', async () => {
  component.fetchData();

  // Wait for specific condition
  await waitFor(() => component.isLoaded());

  expect(component.getData()).toBeDefined();
});

test('should handle promise chain', async () => {
  component.doAsyncWork();

  // Flush all pending promises
  await flushPromises();

  expect(component.state).toBe('complete');
});
```

### Testing Shadow DOM

```typescript
import { expectShadowElement, expectTextContent } from '../test-utils';

test('should render in shadow DOM', () => {
  const display = new HLTBDisplay();
  display.mount(targetElement);

  const hostElement = document.querySelector('.hltb-display-host');
  const shadowRoot = hostElement?.shadowRoot;

  expect(shadowRoot).toBeTruthy();

  if (shadowRoot) {
    // Find element in shadow DOM
    expectShadowElement(shadowRoot, '.hltb-container');

    // Check text content
    expectTextContent(shadowRoot, 'Expected Text');
  }
});
```

### Testing Performance

```typescript
import { expectTimingBelow, expectPerformanceMetrics } from '../test-utils';

test('should create component quickly', () => {
  const start = performance.now();
  const display = new HLTBDisplay();
  const end = performance.now();

  expectTimingBelow(end - start, 10);  // < 10ms
});

test('should meet all performance targets', () => {
  const display = new HLTBDisplay();
  display.mount(targetElement);

  const metrics = display.getMetrics();

  expectPerformanceMetrics(metrics, {
    creation: 10,
    injection: 20,
    render: 20,
    total: 50
  });
});
```

### Testing Accessibility

```typescript
import { expectAriaAttributes, expectAccessible } from '../test-utils';

test('should have correct ARIA attributes', () => {
  const display = new HLTBDisplay({ accessibility: true });
  display.mount(targetElement);

  const container = getContainer(display);

  expectAriaAttributes(container, {
    'role': 'region',
    'aria-label': 'HowLongToBeat completion times'
  });
});
```

### Testing Security

```typescript
import { expectNoXSS } from '../test-utils';

test('should prevent XSS attacks', () => {
  const display = new HLTBDisplay();
  display.mount(targetElement);

  const maliciousData = {
    gameId: '<script>alert("XSS")</script>'
  };

  display.setData(maliciousData as any);

  const shadowRoot = getShadowRoot(display);
  expectNoXSS(shadowRoot);
});
```

---

## Debugging Tests

### Running Single Test

```bash
# Run specific file
npm test HLTBDisplay.test.ts

# Run tests matching pattern
npm test -- -t "should render loading state"

# Run only one test (use test.only)
test.only('should focus on this test', () => {
  // ...
});
```

### Debug Mode

```bash
# Start debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Then open chrome://inspect in Chrome
# Click "inspect" on the Node process
```

### Verbose Output

```bash
# See detailed test output
npm test -- --verbose

# See console.log statements
npm test -- --silent=false
```

### Common Issues

**Issue: Async timing failures**
```typescript
// ❌ Bad - Race condition
test('should update', () => {
  component.fetchData();
  expect(component.data).toBeDefined();  // Might not be ready
});

// ✅ Good - Wait for async
test('should update', async () => {
  component.fetchData();
  await waitFor(() => component.data !== null);
  expect(component.data).toBeDefined();
});
```

**Issue: DOM not cleaned up**
```typescript
// ❌ Bad - DOM persists between tests
test('first test', () => {
  document.body.innerHTML = '<div>test</div>';
});

// ✅ Good - Clean up in afterEach
afterEach(() => {
  cleanupDOM();
});
```

**Issue: Mocks not reset**
```typescript
// ❌ Bad - Mocks carry over
test('first test', () => {
  mockFunction.mockReturnValue('first');
});

// ✅ Good - Reset in beforeEach
beforeEach(() => {
  jest.clearAllMocks();
  resetChromeMocks();
});
```

---

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ❌ Bad - Testing implementation details
test('should call private method', () => {
  expect(component['privateMethod']).toHaveBeenCalled();
});

// ✅ Good - Testing public behavior
test('should update display when data changes', () => {
  component.setData(newData);
  expect(component.getState()).toBe(DisplayState.SUCCESS);
});
```

### 2. Keep Tests Independent

```typescript
// ❌ Bad - Tests depend on each other
let sharedComponent;

test('creates component', () => {
  sharedComponent = new Component();
});

test('uses component', () => {
  sharedComponent.doSomething();  // Breaks if first test skipped
});

// ✅ Good - Each test is independent
test('creates and uses component', () => {
  const component = new Component();
  component.doSomething();
  expect(component.state).toBe('done');
});
```

### 3. Use Descriptive Test Names

```typescript
// ❌ Bad - Vague test name
test('it works', () => { ... });

// ✅ Good - Describes behavior and condition
test('should display error message when API request fails', () => { ... });
```

### 4. Test Edge Cases

```typescript
test('should handle null values', () => {
  const data = createMockHLTBData({
    mainStory: null,
    mainExtra: null,
    completionist: null
  });

  display.setData(data);

  expect(display.getState()).toBe(DisplayState.NO_DATA);
});

test('should handle very large numbers', () => {
  const data = createMockHLTBData({ mainStory: 999 });

  display.setData(data);

  const shadowRoot = getShadowRoot(display);
  expectTextContent(shadowRoot, '999');
});
```

### 5. Mock External Dependencies

```typescript
// ❌ Bad - Testing real Chrome API
test('should send message', async () => {
  const result = await chrome.runtime.sendMessage({ action: 'test' });
  // This will fail in test environment
});

// ✅ Good - Mock Chrome API
test('should send message', async () => {
  mockSendMessage({ success: true });

  const result = await chrome.runtime.sendMessage({ action: 'test' });

  expect(result.success).toBe(true);
});
```

### 6. Clean Up Resources

```typescript
test('should cleanup on destroy', () => {
  const display = new HLTBDisplay();
  display.mount(targetElement);

  expect(document.querySelector('.hltb-display-host')).toBeTruthy();

  display.destroy();

  // Verify cleanup
  expect(document.querySelector('.hltb-display-host')).toBeNull();
});
```

---

## CI/CD Integration

### Running Tests in CI

```yaml
# GitHub Actions example
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

### Coverage Thresholds

Configure in `jest.config.ts`:

```typescript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 90,
    lines: 85,
    statements: 85
  },
  './src/content/components/': {
    branches: 90,
    functions: 100,
    lines: 95,
    statements: 95
  }
}
```

### Pre-commit Hooks

Add to `package.json`:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```

---

## Test Coverage Reports

### Generating Reports

```bash
# Generate coverage report
npm test -- --coverage

# Open HTML report
open coverage/index.html  # macOS
start coverage/index.html  # Windows
xdg-open coverage/index.html  # Linux
```

### Reading Coverage Reports

**Coverage Metrics**:
- **Line Coverage**: Percentage of code lines executed
- **Branch Coverage**: Percentage of code branches executed
- **Function Coverage**: Percentage of functions called
- **Statement Coverage**: Percentage of statements executed

**Example Output**:
```
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
HLTBDisplay.ts      |   95.2  |   88.4   |  100.0  |   95.8  |
InjectionManager.ts |   92.3  |   85.7   |   96.6  |   93.1  |
content-script.ts   |   88.9  |   81.2   |   92.3  |   89.5  |
```

---

## Appendix: Useful Commands

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Run specific file
npm test HLTBDisplay.test.ts

# Run tests matching pattern
npm test -- -t "loading state"

# Coverage
npm test -- --coverage

# Verbose output
npm test -- --verbose

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Update snapshots
npm test -- -u

# Run only changed tests
npm test -- --onlyChanged

# Fail fast (stop on first failure)
npm test -- --bail

# Show test duration
npm test -- --verbose --testNamePattern=""
```

---

## Getting Help

### Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Chrome Extension Testing Guide](https://developer.chrome.com/docs/extensions/mv3/testing/)

### Common Questions

**Q: How do I test Shadow DOM?**
A: Use the `expectShadowElement` and `expectTextContent` helpers from test-utils.

**Q: How do I test async operations?**
A: Use `waitFor()` or `flushPromises()` from test-utils.

**Q: How do I mock Chrome APIs?**
A: Use helpers from `chrome-utils.ts` like `mockSendMessage()`.

**Q: Why are my tests failing in CI but passing locally?**
A: Check for async timing issues, ensure mocks are reset, and verify DOM cleanup.

**Q: How do I debug a failing test?**
A: Use `test.only()`, add `console.log()`, or use Node debugger with `--inspect-brk`.

---

**Document Version**: 1.0
**Last Updated**: 2025-01-21
**Maintainer**: Development Team
**Review Cycle**: Monthly
