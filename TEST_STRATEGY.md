# HLTB UI Component Testing Strategy

## Executive Summary

This document outlines the comprehensive testing strategy for the HLTB Steam Extension UI components, including the HLTBDisplay component, InjectionManager, and content script integration. The strategy follows industry best practices with a focus on reliability, maintainability, and confidence in deployments.

**Test Pyramid Distribution:**
- Unit Tests: 70% (90+ tests)
- Integration Tests: 20% (25+ tests)
- End-to-End Tests: 10% (12+ tests)

**Coverage Goals:**
- Overall Code Coverage: >85%
- Critical Path Coverage: 100%
- Security-Critical Code: 100%

---

## 1. System Architecture Analysis

### 1.1 Component Overview

The HLTB UI system consists of three primary components:

1. **HLTBDisplay Component** (`src/content/components/HLTBDisplay.ts`)
   - Shadow DOM-based Web Component
   - State machine pattern (LOADING/SUCCESS/ERROR/NO_DATA)
   - Performance optimized (<50ms total render time)
   - WCAG 2.1 AA compliant

2. **InjectionManager** (`src/content/managers/InjectionManager.ts`)
   - Finds optimal injection points on Steam pages
   - Manages component lifecycle
   - Auto-reinject on DOM changes
   - Cleanup and memory management

3. **Content Script** (`src/content/content-script.ts`)
   - Game page detection
   - Game info extraction (4 strategies)
   - Message passing to background
   - Navigation observer for SPA
   - Integration orchestrator

### 1.2 Dependencies

**External Dependencies:**
- Chrome Extension APIs (runtime, storage)
- DOM APIs (ShadowRoot, MutationObserver)
- Performance API (metrics tracking)

**Internal Dependencies:**
- Type definitions (`types/HLTB.ts`)
- Background service worker (message passing)

### 1.3 Risk Areas

1. **Shadow DOM Isolation**: Ensuring styles don't leak
2. **Memory Leaks**: Proper cleanup of observers and references
3. **Performance**: Meeting <50ms render target
4. **XSS Prevention**: No innerHTML usage
5. **State Management**: Correct state transitions
6. **Navigation Handling**: SPA navigation detection
7. **Error Handling**: Graceful degradation

---

## 2. Test Pyramid Strategy

### 2.1 Unit Tests (70% - ~90 tests)

**Scope**: Test individual methods and functions in isolation

**Components:**

#### HLTBDisplay Component (40 tests)
- **Creation & Configuration** (5 tests)
  - Default configuration
  - Custom configuration
  - Configuration merging
  - Invalid configuration handling
  - Callback registration

- **Lifecycle Management** (8 tests)
  - Constructor initialization
  - Mount to DOM element
  - Mount positions (before/after/prepend/append)
  - Destroy and cleanup
  - Double mount prevention
  - Mount to invalid target
  - Performance metrics tracking
  - Callback execution order

- **State Management** (10 tests)
  - State transitions (all combinations)
  - setLoading()
  - setData() with valid data
  - setData() with partial data (null values)
  - setData() with invalid data
  - setError() with string
  - setError() with Error object
  - State persistence
  - ARIA live region updates
  - getState() accuracy

- **Rendering** (12 tests)
  - Loading state render
  - Success state render (full data)
  - Success state render (partial data)
  - Error state render
  - No data state render
  - Data attribute updates
  - Theme application
  - Animation toggle
  - Responsive layout
  - Accessibility attributes
  - Link generation
  - Badge generation

- **Shadow DOM** (5 tests)
  - Shadow root creation
  - Style injection
  - Style isolation verification
  - Shadow DOM cleanup
  - Re-style on theme change

#### InjectionManager (25 tests)
- **Initialization** (3 tests)
  - Default configuration
  - Custom configuration
  - Custom injection points

- **Injection Point Discovery** (8 tests)
  - Find Store page injection point
  - Find Community page injection point
  - Priority-based selection
  - Fallback chain
  - No valid injection point
  - Custom injection point priority
  - Condition evaluation
  - Multiple valid points

- **Component Lifecycle** (6 tests)
  - Inject HLTB data
  - Show loading state
  - Show error state
  - Update existing data
  - Cleanup current display
  - Destroy manager

- **Auto Re-injection** (4 tests)
  - Setup mutation observer
  - Detect component removal
  - Observer cleanup
  - Disable auto-reinject

- **Error Handling** (4 tests)
  - Invalid data handling
  - Missing injection point
  - Display creation failure
  - Observer setup failure

#### Content Script (25 tests)
- **Initialization** (4 tests)
  - Game page detection
  - Non-game page skipping
  - Extension enabled check
  - Extension disabled handling

- **Game Info Extraction** (8 tests)
  - URL title extraction
  - App ID extraction
  - Meta tag extraction (OpenGraph)
  - DOM element extraction
  - Fallback strategy order
  - Title cleaning (URL)
  - Title cleaning (meta)
  - Missing game info handling

- **Message Passing** (5 tests)
  - Send settings request
  - Send HLTB fetch request
  - Handle successful response
  - Handle error response
  - Handle network failure

- **Navigation Observer** (4 tests)
  - Setup observer
  - Detect navigation
  - Re-initialize on game page
  - Skip non-game pages

- **Integration Orchestration** (4 tests)
  - Complete initialization flow
  - Loading state injection
  - Data injection
  - Error state handling

### 2.2 Integration Tests (20% - ~25 tests)

**Scope**: Test component interactions and data flows

#### Component Interaction (10 tests)
- InjectionManager + HLTBDisplay creation
- InjectionManager mount and data update
- Content script + InjectionManager integration
- Content script + Background message flow
- Theme propagation through layers
- Error propagation through layers
- Performance metrics aggregation
- Cleanup cascade
- Re-injection workflow
- State synchronization

#### Steam Page Scenarios (8 tests)
- Store page injection (full flow)
- Community page injection (full flow)
- Multiple injection points fallback
- Dynamic content handling
- SPA navigation between games
- Extension toggle during session
- Cache hit scenario
- Cache miss scenario

#### Message Passing Integration (7 tests)
- Settings retrieval flow
- HLTB data fetch flow
- Cache check and update
- Error response handling
- Timeout handling
- Concurrent requests
- Background service restart

### 2.3 End-to-End Tests (10% - ~12 tests)

**Scope**: Test complete user scenarios

#### User Workflows (6 tests)
- First visit to game page (no cache)
- Return visit to game page (with cache)
- Navigate between multiple games
- Toggle extension off/on
- Clear cache and refresh
- Error recovery workflow

#### Performance Scenarios (3 tests)
- Render time <50ms validation
- Memory usage validation
- DOM operation count validation

#### Accessibility Scenarios (3 tests)
- Screen reader navigation
- Keyboard-only navigation
- High contrast mode

---

## 3. Mocking Strategy

### 3.1 Chrome APIs

**Location**: `tests/setup.js` (enhanced for TypeScript in `tests/setup.ts`)

**Mocked APIs:**
```typescript
chrome.runtime.sendMessage()      // Message passing
chrome.runtime.onMessage          // Message listeners
chrome.storage.local.get()        // Storage retrieval
chrome.storage.local.set()        // Storage persistence
chrome.alarms                     // Cache cleanup
```

**Strategy:**
- Use Jest mocks with `mockImplementation()`
- Reset all mocks between tests
- Provide realistic response data
- Simulate async operations with Promises

### 3.2 DOM APIs

**JSDOM Environment**: All tests run in JSDOM

**Shadow DOM Mocking:**
```typescript
// Enhanced attachShadow mock
Element.prototype.attachShadow = jest.fn(function(init) {
  const shadowRoot = document.createElement('div');
  shadowRoot.mode = init.mode;
  this.shadowRoot = shadowRoot;
  return shadowRoot;
});
```

**MutationObserver Mocking:**
```typescript
global.MutationObserver = jest.fn(callback => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));
```

**Performance API Mocking:**
```typescript
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn()
};
```

### 3.3 Component Dependencies

**HLTBDisplay Mocking (for InjectionManager tests):**
```typescript
jest.mock('../components/HLTBDisplay', () => ({
  HLTBDisplay: jest.fn(),
  createHLTBDisplay: jest.fn()
}));
```

**InjectionManager Mocking (for Content Script tests):**
```typescript
jest.mock('../managers/InjectionManager', () => ({
  InjectionManager: jest.fn(),
  createInjectionManager: jest.fn()
}));
```

---

## 4. Test Scenarios

### 4.1 HLTBDisplay Test Scenarios

#### Happy Path
- Create component with default config
- Mount to valid element
- Set loading state
- Update with complete data
- Update theme
- Destroy component

#### Edge Cases
- Mount with all 4 positions
- Data with null values (partial)
- Data with 0 hours
- Very large hour values (>100)
- Empty game title
- Missing gameId

#### Error Conditions
- Mount to null element
- Mount when already mounted
- Invalid data structure
- Missing required fields
- Shadow DOM not supported
- Animation frame errors

#### Security Cases
- XSS prevention (no innerHTML)
- Safe data rendering
- URL sanitization in links
- CSS injection prevention

#### Performance Cases
- Render time <20ms
- Creation time <10ms
- Mount time <20ms
- Total time <50ms
- DOM operations count
- Memory cleanup verification

### 4.2 InjectionManager Test Scenarios

#### Happy Path
- Find injection point on Store page
- Find injection point on Community page
- Inject HLTB data successfully
- Show loading state
- Update existing data
- Cleanup and destroy

#### Edge Cases
- Multiple valid injection points (priority selection)
- No valid injection points
- Custom injection points override defaults
- Disabled auto-reinject
- Component removed from DOM

#### Error Conditions
- Invalid HLTB data
- Display creation failure
- Mount failure
- Observer setup failure

#### Performance Cases
- Injection point discovery <5ms
- Component creation <15ms
- Total injection <30ms

### 4.3 Content Script Test Scenarios

#### Happy Path
- Detect Store game page
- Detect Community game page
- Extract game info from URL
- Extract game info from DOM
- Send messages successfully
- Handle successful response
- Inject UI component

#### Edge Cases
- Non-game page (skip initialization)
- Extension disabled
- Missing app ID
- Missing game title
- SPA navigation
- Multiple rapid navigations

#### Error Conditions
- Message sending failure
- Background service unavailable
- Invalid response format
- Injection manager failure
- Network timeout

#### Performance Cases
- Initialization <50ms
- Game detection <10ms
- Message roundtrip <100ms

---

## 5. Coverage Goals

### 5.1 Overall Coverage Targets

| Metric | Target | Critical Path |
|--------|--------|---------------|
| Line Coverage | >85% | 100% |
| Branch Coverage | >80% | 100% |
| Function Coverage | >90% | 100% |
| Statement Coverage | >85% | 100% |

### 5.2 Component-Specific Targets

**HLTBDisplay:**
- Public methods: 100%
- Private methods: >90%
- State transitions: 100%
- Error handlers: 100%
- Render methods: >95%

**InjectionManager:**
- Public methods: 100%
- Injection point logic: 100%
- Error handling: 100%
- Cleanup methods: 100%

**Content Script:**
- Initialization: 100%
- Game detection: 100%
- Message passing: 100%
- Navigation handling: >90%

### 5.3 Security-Critical Coverage

**XSS Prevention: 100%**
- All DOM manipulation paths
- User data rendering
- URL generation
- Message handling

**Input Validation: 100%**
- Game title validation
- App ID validation
- HLTB data validation
- Configuration validation

---

## 6. CI/CD Integration

### 6.1 Test Execution Pipeline

```yaml
# GitHub Actions / CI Pipeline
test:
  stages:
    - lint          # ESLint + TypeScript checks
    - unit          # Fast unit tests
    - integration   # Integration tests
    - e2e           # End-to-end tests
    - coverage      # Coverage reporting
```

### 6.2 Test Execution Order

1. **Lint Stage** (30s)
   - TypeScript type checking
   - ESLint code quality
   - Fast fail on syntax errors

2. **Unit Tests** (1-2 min)
   - Run in parallel by component
   - Fast feedback loop
   - ~90 tests

3. **Integration Tests** (2-3 min)
   - Sequential execution
   - ~25 tests

4. **E2E Tests** (3-5 min)
   - Full workflow validation
   - ~12 tests

5. **Coverage Analysis** (30s)
   - Generate reports
   - Enforce thresholds
   - Upload to coverage service

### 6.3 Quality Gates

**Pre-commit:**
- No TypeScript errors
- No ESLint errors
- Unit tests pass

**Pre-merge:**
- All tests pass
- Coverage >85%
- No security vulnerabilities
- Performance benchmarks met

**Pre-release:**
- Full test suite pass
- Manual testing checklist
- Performance validation
- Accessibility audit

### 6.4 Failure Handling

**Retry Policy:**
- Unit tests: No retry (should be deterministic)
- Integration tests: 1 retry (handle timing issues)
- E2E tests: 2 retries (handle flakiness)

**Fail Fast:**
- Stop on lint errors
- Stop on critical path test failures
- Continue on non-critical failures (report at end)

---

## 7. Test Tooling and Framework

### 7.1 Core Framework

**Jest** (v29.6.0)
- Test runner
- Assertion library
- Mocking framework
- Coverage reporting

**Configuration**: `jest.config.ts`
```typescript
{
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.{js,ts}'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85
    }
  }
}
```

### 7.2 Testing Libraries

**@testing-library/dom** (Optional)
- Better DOM assertions
- User-centric queries
- Accessibility helpers

**jest-environment-jsdom** (v30.1.2)
- Browser-like environment
- DOM API support
- Shadow DOM support

### 7.3 Type Safety

**TypeScript + @types/jest**
- Type-safe test code
- IntelliSense support
- Compile-time error detection

### 7.4 Code Coverage

**Istanbul (via Jest)**
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

**Coverage Reports:**
- Terminal summary
- HTML report (coverage/index.html)
- LCOV format (for CI integration)

### 7.5 Performance Testing

**Performance API**
- Built-in `performance.now()`
- Custom timing utilities
- Benchmark assertions

**Custom Matchers:**
```typescript
expect(time).toBeLessThan(50); // 50ms threshold
expect(metrics.totalTime).toBeWithinRange(0, 50);
```

---

## 8. Test Data Management

### 8.1 Mock Data Factories

**Location**: `tests/test-utils/factories.ts`

```typescript
// HLTB Data Factory
export const createMockHLTBData = (overrides?: Partial<HLTBData>): HLTBData => ({
  mainStory: 12,
  mainExtra: 18,
  completionist: 25,
  gameId: 12345,
  source: 'api',
  confidence: 'high',
  ...overrides
});

// Game Info Factory
export const createMockGameInfo = (overrides?: Partial<GameInfo>): GameInfo => ({
  appId: '12345',
  title: 'Test Game',
  ...overrides
});

// Display Config Factory
export const createMockDisplayConfig = (
  overrides?: Partial<HLTBDisplayConfig>
): Required<HLTBDisplayConfig> => ({
  enableAnimations: true,
  showLoading: true,
  showErrors: true,
  theme: { mode: 'dark' },
  customClasses: [],
  accessibility: true,
  enableLink: true,
  showSource: true,
  ...overrides
});
```

### 8.2 Fixture Data

**Location**: `tests/fixtures/`

- `hltb-data.json` - Sample HLTB responses
- `steam-pages.html` - Sample Steam page HTML
- `error-responses.json` - Error scenarios

### 8.3 Test Utilities

**Location**: `tests/test-utils/`

- `dom-utils.ts` - DOM setup helpers
- `chrome-utils.ts` - Chrome API helpers
- `async-utils.ts` - Promise/timing helpers
- `assertion-utils.ts` - Custom matchers

---

## 9. Test Organization

### 9.1 File Structure

```
tests/
├── setup.js                          # Jest setup (existing)
├── setup.ts                          # TypeScript Jest setup (new)
├── test-utils/                       # Shared utilities (new)
│   ├── factories.ts                  # Mock data factories
│   ├── dom-utils.ts                  # DOM helpers
│   ├── chrome-utils.ts               # Chrome API helpers
│   ├── async-utils.ts                # Async helpers
│   └── assertion-utils.ts            # Custom matchers
├── fixtures/                         # Test data (new)
│   ├── hltb-data.json
│   ├── steam-pages.html
│   └── error-responses.json
├── unit/                             # Unit tests (new)
│   ├── HLTBDisplay.test.ts           # Display component
│   ├── InjectionManager.test.ts      # Injection manager
│   └── content-script.test.ts        # Content script
├── integration/                      # Integration tests (new)
│   ├── component-interaction.test.ts # Component integration
│   ├── steam-pages.test.ts           # Steam page scenarios
│   └── message-passing.test.ts       # Message flow
├── e2e/                              # End-to-end tests (new)
│   ├── user-workflows.test.ts        # User scenarios
│   ├── performance.test.ts           # Performance validation
│   └── accessibility.test.ts         # A11y validation
└── [existing test files...]          # Keep existing tests
```

### 9.2 Naming Conventions

**Test Files:**
- Pattern: `[ComponentName].test.ts`
- Location: Mirrors source structure
- Example: `HLTBDisplay.test.ts` for `HLTBDisplay.ts`

**Test Suites:**
- `describe('[ComponentName]', () => {})` - Top level
- `describe('[MethodName]', () => {})` - Method level
- `describe('[Scenario]', () => {})` - Scenario grouping

**Test Cases:**
- `test('should [expected behavior] when [condition]', () => {})`
- Example: `test('should render loading state when setLoading is called', () => {})`

### 9.3 Test Setup Patterns

**beforeEach:**
- Reset mocks
- Clear DOM
- Reset global state
- Create fresh instances

**afterEach:**
- Cleanup components
- Restore mocks
- Clear timers
- Free memory

**beforeAll / afterAll:**
- One-time setup (rare)
- Expensive operations
- Test environment config

---

## 10. Debugging and Maintenance

### 10.1 Debugging Failing Tests

**Enable Verbose Output:**
```bash
npm test -- --verbose
```

**Run Single Test:**
```bash
npm test -- HLTBDisplay.test.ts
npm test -- -t "should render loading state"
```

**Debug Mode:**
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

**Common Issues:**
1. **Async timing**: Add proper `await` and `async`
2. **Mock state**: Ensure mocks are reset between tests
3. **DOM cleanup**: Clear DOM after tests
4. **Memory leaks**: Destroy components in cleanup

### 10.2 Maintaining Test Suite

**Regular Tasks:**
- Update tests when API changes
- Add tests for bug fixes
- Refactor tests with code
- Remove obsolete tests
- Update mock data

**Code Review Checklist:**
- [ ] Tests added for new features
- [ ] Tests updated for changes
- [ ] All tests pass
- [ ] Coverage maintained/improved
- [ ] No commented-out tests
- [ ] No skipped tests without reason

### 10.3 Performance Optimization

**Slow Tests:**
- Use `jest.setTimeout()` sparingly
- Mock expensive operations
- Parallelize test files
- Use `test.only()` during development

**Memory Issues:**
- Cleanup in `afterEach`
- Avoid global state
- Clear large objects
- Use `--detectLeaks` flag

---

## 11. Security Testing

### 11.1 XSS Prevention Testing

**Test Scenarios:**
```typescript
test('should not execute script tags in game title', () => {
  const maliciousData = {
    mainStory: 12,
    gameId: '<script>alert("XSS")</script>'
  };

  display.setData(maliciousData);

  // Verify no script execution
  expect(shadowRoot.innerHTML).not.toContain('<script>');
  expect(shadowRoot.textContent).toContain('script'); // Should be text
});
```

**Coverage:**
- Game title rendering
- HLTB data display
- Error messages
- Source badges
- All user-controlled data

### 11.2 Input Validation Testing

**Test Invalid Inputs:**
```typescript
test('should reject invalid HLTB data structure', () => {
  const invalidData = { invalid: 'structure' };

  display.setData(invalidData as any);

  expect(display.getState()).toBe(DisplayState.ERROR);
});
```

**Coverage:**
- All public method parameters
- Message payloads
- Storage data
- URL parameters

### 11.3 Injection Attack Testing

**Test Malicious Patterns:**
- SQL-like strings (not applicable, but defensive)
- HTML entities
- JavaScript code strings
- Special characters
- Unicode exploits

---

## 12. Accessibility Testing

### 12.1 ARIA Attributes

**Test Coverage:**
```typescript
test('should have correct ARIA attributes in loading state', () => {
  display.setLoading();

  const loadingDiv = shadowRoot.querySelector('.hltb-loading');
  expect(loadingDiv).toHaveAttribute('role', 'status');
  expect(loadingDiv).toHaveAttribute('aria-live', 'polite');
});
```

### 12.2 Keyboard Navigation

**Test Scenarios:**
- Tab focus order
- Enter key activation
- Escape key handling
- Arrow key navigation (if applicable)

### 12.3 Screen Reader Support

**Test Scenarios:**
- ARIA labels present
- Live regions update
- Role attributes correct
- Alt text for icons/images

---

## 13. Performance Testing Strategy

### 13.1 Timing Benchmarks

**Target Metrics:**
- Component creation: <10ms
- Mount operation: <20ms
- Render operation: <20ms
- Total time: <50ms

**Test Pattern:**
```typescript
test('should create component in under 10ms', () => {
  const start = performance.now();
  const display = new HLTBDisplay();
  const end = performance.now();

  expect(end - start).toBeLessThan(10);
});
```

### 13.2 Memory Benchmarks

**Test Scenarios:**
- No memory leaks after destroy
- Proper cleanup of observers
- Reference clearing
- Event listener removal

**Test Pattern:**
```typescript
test('should not leak memory after destroy', () => {
  const display = new HLTBDisplay();
  display.mount(targetElement);
  display.destroy();

  // Verify all references cleared
  expect(display.getState()).toBe(null); // or appropriate check
});
```

### 13.3 DOM Operations Count

**Target**: Minimize DOM operations for performance

**Test Pattern:**
```typescript
test('should minimize DOM operations during render', () => {
  const display = new HLTBDisplay();
  display.mount(targetElement);

  const metrics = display.getMetrics();

  expect(metrics.domOperations).toBeLessThan(20); // Reasonable limit
});
```

---

## 14. Continuous Improvement

### 14.1 Metrics Tracking

**Track Over Time:**
- Test count (by category)
- Coverage percentage
- Test execution time
- Flaky test rate
- Bug escape rate

**Tools:**
- Jest coverage reports
- CI/CD metrics
- Code coverage services (Codecov, Coveralls)

### 14.2 Test Quality Metrics

**Monitor:**
- Test readability
- Test maintainability
- Test isolation
- Test determinism
- False positive rate

### 14.3 Feedback Loop

**Regular Reviews:**
- Quarterly test suite audit
- Remove obsolete tests
- Refactor brittle tests
- Update mock data
- Optimize slow tests

---

## 15. Success Criteria

### 15.1 Initial Launch Criteria

- [ ] All 127+ tests implemented
- [ ] All tests passing
- [ ] Coverage >85%
- [ ] Critical path coverage 100%
- [ ] No security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Documentation complete

### 15.2 Ongoing Criteria

- [ ] No new features without tests
- [ ] No commits with failing tests
- [ ] Coverage never decreases
- [ ] Test suite runs in <5 minutes
- [ ] No flaky tests in main branch
- [ ] Security tests always pass

---

## Appendix A: Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test HLTBDisplay.test.ts

# Run tests matching pattern
npm test -- -t "should render"

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run with verbose output
npm test -- --verbose

# Run only changed tests
npm test -- --onlyChanged

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand

# Update snapshots (if using)
npm test -- -u

# Check coverage thresholds
npm test -- --coverage --coverageThreshold='{"global":{"lines":85}}'
```

---

## Appendix B: Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/testing/)

### Tools
- [Jest](https://jestjs.io/) - Test framework
- [ts-jest](https://kulshekhar.github.io/ts-jest/) - TypeScript support
- [jest-environment-jsdom](https://jestjs.io/docs/configuration#testenvironment-string) - DOM environment

### Best Practices
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Kent C. Dodds Testing Articles](https://kentcdodds.com/testing)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-21
**Author**: Claude Code
**Review Cycle**: Quarterly
