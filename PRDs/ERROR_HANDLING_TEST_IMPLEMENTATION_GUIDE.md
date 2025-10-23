# Error Handling Test Implementation Guide
## Quick Start Guide for Implementing the Test Strategy

**Version**: 1.0
**Last Updated**: 2025-10-22

---

## Quick Start

### Step 1: Install Dependencies (if needed)

The project already has Jest and TypeScript configured. No additional dependencies required.

```bash
# Verify Jest is installed
npm test -- --version
```

### Step 2: Create Test Directory Structure

```bash
# Create directories
mkdir -p tests/shared
mkdir -p tests/integration
mkdir -p tests/e2e
mkdir -p tests/mocks

# Files already created:
# - tests/shared/test-helpers.ts
# - tests/mocks/chrome-error-mocks.ts
```

### Step 3: Run Your First Test

Create `tests/shared/errors.test.ts` with a simple test:

```typescript
import { HLTBError } from '../../src/shared/errors';

describe('HLTBError', () => {
  test('should create error with properties', () => {
    const error = new HLTBError('Test', 'CODE', true, 'User message');
    expect(error.message).toBe('Test');
    expect(error.code).toBe('CODE');
  });
});
```

Run the test:

```bash
npm test -- tests/shared/errors.test.ts
```

---

## Implementation Phases

### Phase 1: Unit Tests (Week 1)

**Goal**: Implement 60-67 unit tests

**Priority Order**:

1. **errors.test.ts** (15 tests - 2-3 hours)
   - Start with HLTBError base class
   - Then each error subclass (2 tests each)
   - Finally type guards and utilities
   - Reference: See full example in main strategy doc

2. **safe-execute.test.ts** (20 tests - 3-4 hours)
   - safeExecute (4 tests)
   - safeExecuteSync (3 tests)
   - withErrorBoundary (3 tests)
   - retryWithBackoff (5 tests)
   - withTimeout (3 tests)
   - batchExecute (2 tests)

3. **error-handler.test.ts** (25 tests - 4-5 hours)
   - Singleton pattern (3 tests)
   - Error handling (5 tests)
   - Global handlers (3 tests)
   - Recovery mechanisms (5 tests)
   - Error log management (5 tests)
   - User notifications (4 tests)

**Daily Target**: 10-15 tests per day

**Validation**: Run with coverage after each file
```bash
npm test -- tests/shared --coverage
```

**Success Criteria**: All unit tests passing, 95%+ coverage

---

### Phase 2: Integration Tests (Week 2)

**Goal**: Implement 17-19 integration tests

**Priority Order**:

1. **content-error-handling.test.ts** (8 tests - 4-5 hours)
   - Game detection errors (2 tests)
   - Background communication errors (3 tests)
   - DOM injection errors (2 tests)
   - Error recovery (1 test)

2. **background-error-handling.test.ts** (6 tests - 3-4 hours)
   - Input validation (2 tests)
   - Database errors (1 test)
   - Game not found (1 test)
   - Storage errors (1 test)
   - Concurrent errors (1 test)

3. **message-passing-errors.test.ts** (3 tests - 1-2 hours)
   - sendMessage rejection
   - Timeout handling
   - Malformed responses

**Challenges**:
- Need to mock content script imports
- DOM manipulation testing
- Async timing issues

**Solutions**:
- Use test-helpers.ts functions
- Setup DOM with createSteamPageDOM()
- Use waitForAsync() for timing

**Validation**: Run integration suite
```bash
npm test -- tests/integration --coverage
```

---

### Phase 3: E2E Tests (Week 2-3)

**Goal**: Implement 8-9 E2E tests

**Priority Order**:

1. **error-recovery.test.ts** (4 tests - 2-3 hours)
   - Cache corruption recovery
   - Missing games collection
   - Retry with backoff
   - Background service unavailable

2. **user-notifications.test.ts** (3 tests - 1-2 hours)
   - Error notification display
   - Different notification types
   - Auto-dismiss

3. **critical-errors.test.ts** (2 tests - 1 hour)
   - Database load halt
   - Critical error reporting

**Challenges**:
- Full system integration
- User-visible behavior
- Timing and async coordination

**Solutions**:
- Use chrome-error-mocks.ts scenarios
- Simulate complete flows
- Add explicit waits for UI updates

**Validation**: Run full suite
```bash
npm test -- tests/e2e --coverage
```

---

## Daily Workflow

### Morning Routine

1. **Pull latest changes**
   ```bash
   git pull origin master
   ```

2. **Check test status**
   ```bash
   npm test -- --lastCommit
   ```

3. **Pick next test file** from implementation phases

### Development Cycle

1. **Create test file** with describe block
   ```typescript
   describe('Component - Feature', () => {
     beforeEach(() => {
       // Setup
     });

     test('should...', () => {
       // Test
     });
   });
   ```

2. **Run in watch mode**
   ```bash
   npm test -- tests/shared/errors.test.ts --watch
   ```

3. **Implement tests one at a time**
   - Write test
   - See it fail (red)
   - Make it pass (green)
   - Refactor if needed

4. **Check coverage**
   ```bash
   npm test -- tests/shared/errors.test.ts --coverage
   ```

5. **Commit when file complete**
   ```bash
   git add tests/shared/errors.test.ts
   git commit -m "test: add error class unit tests (15 tests)"
   ```

### Evening Review

1. **Run full suite**
   ```bash
   npm test
   ```

2. **Check coverage report**
   ```bash
   open coverage/lcov-report/index.html
   ```

3. **Update progress** in this document

---

## Common Patterns

### Pattern 1: Testing Error Constructors

```typescript
test('should create error with properties', () => {
  const error = new CustomError('Message', 'CODE');

  expect(error).toBeInstanceOf(CustomError);
  expect(error.message).toBe('Message');
  expect(error.code).toBe('CODE');
  expect(error.stack).toBeDefined();
});
```

### Pattern 2: Testing Async Functions

```typescript
test('should handle async operation', async () => {
  const result = await safeExecute(
    async () => 'success',
    'fallback'
  );

  expect(result).toBe('success');
});
```

### Pattern 3: Testing Error Handlers

```typescript
test('should call error handler on error', async () => {
  const handler = jest.fn();

  await safeExecute(
    async () => { throw new Error('Test'); },
    null,
    handler
  );

  expect(handler).toHaveBeenCalledWith(expect.any(Error));
});
```

### Pattern 4: Testing Chrome Storage

```typescript
test('should save to storage', async () => {
  chrome.storage.local.set.mockResolvedValue(undefined);

  await saveData({ key: 'value' });

  expect(chrome.storage.local.set).toHaveBeenCalledWith(
    expect.objectContaining({ key: 'value' })
  );
});
```

### Pattern 5: Testing Error Recovery

```typescript
test('should retry on failure', async () => {
  const fn = jest.fn()
    .mockRejectedValueOnce(new Error('Fail'))
    .mockResolvedValue('success');

  const result = await retryWithBackoff(fn, 2, 100);

  expect(result).toBe('success');
  expect(fn).toHaveBeenCalledTimes(2);
});
```

### Pattern 6: Testing DOM Injection

```typescript
test('should inject into DOM', () => {
  createSteamPageDOM('store');

  injectComponent(data);

  expect(document.querySelector('.hltb-container')).toBeTruthy();
});
```

### Pattern 7: Testing Notifications

```typescript
test('should show notification', async () => {
  chrome.tabs.query.mockResolvedValue([{ id: 123 }]);

  handler.showUserNotification('Message', 'error');

  await waitForAsync(50);

  expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
    123,
    expect.objectContaining({ message: 'Message' })
  );
});
```

---

## Troubleshooting

### Issue: Import errors in tests

**Problem**: Cannot find module when importing from src/

**Solution**: Check jest.config.ts moduleNameMapper

```typescript
// jest.config.ts
moduleNameMapper: {
  '^@/shared/(.*)$': '<rootDir>/src/shared/$1'
}
```

### Issue: Chrome API not defined

**Problem**: chrome.storage is undefined

**Solution**: Import setup.js at top of test

```typescript
// At top of test file
require('../setup');
```

Or use chrome-error-mocks.ts:

```typescript
import { setupChromeMocksWithErrors } from '../mocks/chrome-error-mocks';

const mocks = setupChromeMocksWithErrors();
```

### Issue: Async tests timing out

**Problem**: Test hangs and times out

**Solution**: Ensure promises are awaited

```typescript
// Bad
test('async test', () => {
  asyncFunction(); // Not awaited!
});

// Good
test('async test', async () => {
  await asyncFunction();
});
```

### Issue: Mocks not resetting between tests

**Problem**: Previous test state affects next test

**Solution**: Add beforeEach with reset

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  global.resetChromeMocks();
});
```

### Issue: ErrorHandler singleton persists

**Problem**: ErrorHandler state leaks between tests

**Solution**: Use resetErrorHandler() helper

```typescript
import { resetErrorHandler } from './test-helpers';

beforeEach(() => {
  resetErrorHandler();
});
```

### Issue: Coverage not reaching target

**Problem**: Coverage is 75% but target is 90%

**Solution**: Check uncovered lines

```bash
npm test -- --coverage --verbose
```

Look for:
- Unhandled error paths
- Edge cases not tested
- Error recovery code not triggered

---

## Test Template

Use this template for new test files:

```typescript
/**
 * Tests for [Component Name]
 *
 * [Brief description of what's being tested]
 */

import { Component } from '../../src/path/to/component';
import { resetErrorHandler, waitForAsync } from './test-helpers';

describe('[Component] - [Feature]', () => {
  beforeEach(() => {
    // Reset state
    jest.clearAllMocks();
    resetErrorHandler();

    // Setup mocks
    chrome.storage.local.get.mockResolvedValue({});
  });

  afterEach(() => {
    // Cleanup
  });

  describe('[Sub-feature]', () => {
    test('should [expected behavior] when [condition]', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });

    test('should handle errors gracefully', async () => {
      // Arrange
      chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      // Act & Assert
      await expect(functionUnderTest()).rejects.toThrow('Storage error');
    });
  });
});
```

---

## Progress Tracking

### Unit Tests (60-67 total)

- [ ] errors.test.ts (15 tests)
  - [ ] HLTBError base class (3)
  - [ ] DatabaseLoadError (2)
  - [ ] GameNotFoundError (2)
  - [ ] LowConfidenceMatchError (2)
  - [ ] SteamPageDetectionError (2)
  - [ ] DOMInjectionError (2)
  - [ ] StorageError (2)
  - [ ] ValidationError (2)
  - [ ] Type guards and utilities (6)

- [ ] safe-execute.test.ts (20 tests)
  - [ ] safeExecute (4)
  - [ ] safeExecuteSync (3)
  - [ ] withErrorBoundary (3)
  - [ ] retryWithBackoff (5)
  - [ ] withTimeout (3)
  - [ ] batchExecute (2)

- [ ] error-handler.test.ts (25 tests)
  - [ ] Singleton pattern (3)
  - [ ] Error handling (5)
  - [ ] Global handlers (3)
  - [ ] Recovery mechanisms (5)
  - [ ] Error log management (5)
  - [ ] User notifications (4)

### Integration Tests (17-19 total)

- [ ] content-error-handling.test.ts (8 tests)
- [ ] background-error-handling.test.ts (6 tests)
- [ ] message-passing-errors.test.ts (3 tests)

### E2E Tests (8-9 total)

- [ ] error-recovery.test.ts (4 tests)
- [ ] user-notifications.test.ts (3 tests)
- [ ] critical-errors.test.ts (2 tests)

### Coverage Status

- [ ] Unit tests: 95%+ coverage
- [ ] Integration tests: 85%+ coverage
- [ ] Overall: 90%+ coverage

---

## Quick Commands

```bash
# Run all error handling tests
npm test -- tests/shared tests/integration tests/e2e

# Run specific test file
npm test -- tests/shared/errors.test.ts

# Run with coverage
npm test -- tests/shared --coverage

# Watch mode (for development)
npm test -- tests/shared/errors.test.ts --watch

# Run only failed tests
npm test -- --onlyFailures

# Update snapshots (if using)
npm test -- -u

# Verbose output
npm test -- --verbose

# Run with specific timeout
npm test -- --testTimeout=10000
```

---

## Resources

### Documentation
- Main strategy: `PRDs/ERROR_HANDLING_TEST_STRATEGY.md`
- Test helpers: `tests/shared/test-helpers.ts`
- Chrome mocks: `tests/mocks/chrome-error-mocks.ts`
- Jest config: `jest.config.ts`

### External Resources
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)

### Support
- Ask questions in PR comments
- Check existing test files in `tests/` for examples
- Refer to CLAUDE.md for project context

---

## Success Checklist

Before marking implementation complete:

- [ ] All 85-95 tests implemented
- [ ] All tests passing locally
- [ ] Coverage meets targets (90%+ overall)
- [ ] No flaky tests (run suite 3x to verify)
- [ ] CI/CD pipeline green
- [ ] Coverage report uploaded
- [ ] Test documentation updated
- [ ] PR created with test results

---

**End of Implementation Guide**
