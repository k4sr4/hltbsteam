/**
 * Unit Tests for Custom Error Classes
 *
 * Tests all custom error classes, type guards, and utility functions
 * from src/shared/errors.ts
 *
 * Coverage Target: 100% (all error classes and utilities)
 */

import {
  HLTBError,
  DatabaseLoadError,
  GameNotFoundError,
  LowConfidenceMatchError,
  SteamPageDetectionError,
  DOMInjectionError,
  StorageError,
  ValidationError,
  isHLTBError,
  isRecoverableError,
  getUserMessage,
  getErrorCode
} from '../../src/shared/errors';

describe('Custom Error Classes', () => {
  describe('HLTBError Base Class', () => {
    test('should create error with all properties', () => {
      const error = new HLTBError(
        'Test error message',
        'TEST_CODE',
        true,
        'User-friendly message'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HLTBError);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toBe('User-friendly message');
      expect(error.name).toBe('HLTBError');
      expect(error.stack).toBeDefined();
    });

    test('should default recoverable to true when not specified', () => {
      const error = new HLTBError('Test error', 'TEST_CODE');

      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toBeUndefined();
    });

    test('should maintain proper stack trace', () => {
      const error = new HLTBError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('HLTBError');
      // Stack should point to this test file
      expect(error.stack).toContain('errors.test');
    });
  });

  describe('DatabaseLoadError', () => {
    test('should create non-recoverable error with correct properties', () => {
      const error = new DatabaseLoadError('Database failed to load');

      expect(error).toBeInstanceOf(DatabaseLoadError);
      expect(error).toBeInstanceOf(HLTBError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Database failed to load');
      expect(error.code).toBe('DATABASE_LOAD_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('DatabaseLoadError');
      expect(error.userMessage).toContain('Failed to load HLTB database');
    });

    test('should store original error when provided', () => {
      const originalError = new Error('File not found');
      const error = new DatabaseLoadError('DB load failed', originalError);

      expect(error.originalError).toBe(originalError);
      expect(error.originalError?.message).toBe('File not found');
    });
  });

  describe('GameNotFoundError', () => {
    test('should include game title in message and properties', () => {
      const gameTitle = 'Cyberpunk 2077';
      const error = new GameNotFoundError(gameTitle);

      expect(error).toBeInstanceOf(GameNotFoundError);
      expect(error).toBeInstanceOf(HLTBError);
      expect(error.gameTitle).toBe(gameTitle);
      expect(error.message).toContain(gameTitle);
      expect(error.code).toBe('GAME_NOT_FOUND');
      expect(error.recoverable).toBe(true);
      expect(error.name).toBe('GameNotFoundError');
    });

    test('should have user-friendly message mentioning the game', () => {
      const error = new GameNotFoundError('Test Game');

      expect(error.userMessage).toContain('No completion time data available');
      expect(error.userMessage).toContain('Test Game');
      expect(error.userMessage).toContain('Help us expand the database');
    });
  });

  describe('LowConfidenceMatchError', () => {
    test('should include game title and confidence score', () => {
      const gameTitle = 'Test Game';
      const confidence = 45;
      const error = new LowConfidenceMatchError(gameTitle, confidence);

      expect(error).toBeInstanceOf(LowConfidenceMatchError);
      expect(error).toBeInstanceOf(HLTBError);
      expect(error.gameTitle).toBe(gameTitle);
      expect(error.confidence).toBe(confidence);
      expect(error.message).toContain(gameTitle);
      expect(error.message).toContain('45%');
      expect(error.code).toBe('LOW_CONFIDENCE');
      expect(error.recoverable).toBe(true);
    });

    test('should format confidence percentage in user message', () => {
      const error = new LowConfidenceMatchError('Game', 60);

      expect(error.userMessage).toContain('60%');
      expect(error.userMessage).toContain('confidence is low');
      expect(error.userMessage).toContain('Results may not be accurate');
    });
  });

  describe('SteamPageDetectionError', () => {
    test('should be recoverable by default', () => {
      const error = new SteamPageDetectionError('Detection failed');

      expect(error).toBeInstanceOf(SteamPageDetectionError);
      expect(error.code).toBe('PAGE_DETECTION_ERROR');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toContain('Unable to detect game information');
    });

    test('should include detection attempts when provided', () => {
      const error = new SteamPageDetectionError('Failed after retries', 3);

      expect(error.detectionAttempts).toBe(3);
      expect(error.message).toBe('Failed after retries');
    });
  });

  describe('DOMInjectionError', () => {
    test('should include attempted selectors', () => {
      const selectors = ['.selector1', '.selector2', '#selector3'];
      const error = new DOMInjectionError('Injection failed', selectors);

      expect(error).toBeInstanceOf(DOMInjectionError);
      expect(error.attemptedSelectors).toEqual(selectors);
      expect(error.code).toBe('DOM_INJECTION_ERROR');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toContain('Unable to display HLTB data');
    });

    test('should work without selectors array', () => {
      const error = new DOMInjectionError('Injection failed');

      expect(error.attemptedSelectors).toBeUndefined();
      expect(error.message).toBe('Injection failed');
    });
  });

  describe('StorageError', () => {
    test('should include operation type', () => {
      const error = new StorageError('Storage operation failed', 'get');

      expect(error).toBeInstanceOf(StorageError);
      expect(error.operation).toBe('get');
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toContain('Cache storage issue');
    });

    test('should work with all operation types', () => {
      const operations: Array<'get' | 'set' | 'remove' | 'clear'> =
        ['get', 'set', 'remove', 'clear'];

      operations.forEach(op => {
        const error = new StorageError(`${op} failed`, op);
        expect(error.operation).toBe(op);
        expect(error.recoverable).toBe(true);
      });
    });
  });

  describe('ValidationError', () => {
    test('should be non-recoverable by default', () => {
      const error = new ValidationError('Invalid data detected');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.userMessage).toContain('Invalid data');
    });

    test('should include field and value information', () => {
      const error = new ValidationError('Invalid app ID', 'appId', 'abc123');

      expect(error.field).toBe('appId');
      expect(error.value).toBe('abc123');
      expect(error.message).toBe('Invalid app ID');
    });
  });

  describe('Type Guards', () => {
    test('isHLTBError should correctly identify HLTB errors', () => {
      const hltbError = new GameNotFoundError('Test');
      const normalError = new Error('Normal error');
      const notAnError = 'string value';

      expect(isHLTBError(hltbError)).toBe(true);
      expect(isHLTBError(normalError)).toBe(false);
      expect(isHLTBError(notAnError)).toBe(false);
      expect(isHLTBError(null)).toBe(false);
      expect(isHLTBError(undefined)).toBe(false);
    });

    test('isHLTBError should work with all error types', () => {
      const errors = [
        new DatabaseLoadError('DB error'),
        new GameNotFoundError('Game'),
        new LowConfidenceMatchError('Game', 50),
        new SteamPageDetectionError('Detection'),
        new DOMInjectionError('Injection'),
        new StorageError('Storage'),
        new ValidationError('Validation')
      ];

      errors.forEach(error => {
        expect(isHLTBError(error)).toBe(true);
      });
    });

    test('isRecoverableError should check recoverable flag', () => {
      const recoverableError = new GameNotFoundError('Test');
      const nonRecoverableError = new DatabaseLoadError('Critical');
      const normalError = new Error('Normal');

      expect(isRecoverableError(recoverableError)).toBe(true);
      expect(isRecoverableError(nonRecoverableError)).toBe(false);
      expect(isRecoverableError(normalError)).toBe(false);
      expect(isRecoverableError('not an error')).toBe(false);
    });

    test('isRecoverableError should handle all error types', () => {
      const recoverable = [
        new GameNotFoundError('Game'),
        new LowConfidenceMatchError('Game', 50),
        new SteamPageDetectionError('Detection'),
        new DOMInjectionError('Injection'),
        new StorageError('Storage')
      ];

      const nonRecoverable = [
        new DatabaseLoadError('DB'),
        new ValidationError('Validation')
      ];

      recoverable.forEach(error => {
        expect(isRecoverableError(error)).toBe(true);
      });

      nonRecoverable.forEach(error => {
        expect(isRecoverableError(error)).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    test('getUserMessage should return user-friendly message from HLTB errors', () => {
      const error = new GameNotFoundError('Test Game');
      const message = getUserMessage(error);

      expect(message).toContain('No completion time data available');
      expect(message).toBe(error.userMessage);
    });

    test('getUserMessage should return error message for normal errors', () => {
      const error = new Error('Normal error message');
      const message = getUserMessage(error);

      expect(message).toBe('Normal error message');
    });

    test('getUserMessage should handle non-error values', () => {
      expect(getUserMessage('string')).toBe('An unexpected error occurred');
      expect(getUserMessage(null)).toBe('An unexpected error occurred');
      expect(getUserMessage(undefined)).toBe('An unexpected error occurred');
      expect(getUserMessage(123)).toBe('An unexpected error occurred');
    });

    test('getUserMessage should work with all error types', () => {
      const errors = [
        new DatabaseLoadError('DB'),
        new GameNotFoundError('Game'),
        new LowConfidenceMatchError('Game', 50),
        new SteamPageDetectionError('Detection'),
        new DOMInjectionError('Injection'),
        new StorageError('Storage'),
        new ValidationError('Validation')
      ];

      errors.forEach(error => {
        const message = getUserMessage(error);
        expect(message).toBeDefined();
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });

    test('getErrorCode should return code from HLTB errors', () => {
      const error = new GameNotFoundError('Test');
      const code = getErrorCode(error);

      expect(code).toBe('GAME_NOT_FOUND');
    });

    test('getErrorCode should return name from normal errors', () => {
      const error = new Error('Test');
      const code = getErrorCode(error);

      expect(code).toBe('Error');
    });

    test('getErrorCode should handle non-error values', () => {
      expect(getErrorCode('string')).toBe('UNKNOWN_ERROR');
      expect(getErrorCode(null)).toBe('UNKNOWN_ERROR');
      expect(getErrorCode(undefined)).toBe('UNKNOWN_ERROR');
      expect(getErrorCode({})).toBe('UNKNOWN_ERROR');
    });

    test('getErrorCode should work with all error types', () => {
      const expectedCodes: Record<string, string> = {
        DatabaseLoadError: 'DATABASE_LOAD_ERROR',
        GameNotFoundError: 'GAME_NOT_FOUND',
        LowConfidenceMatchError: 'LOW_CONFIDENCE',
        SteamPageDetectionError: 'PAGE_DETECTION_ERROR',
        DOMInjectionError: 'DOM_INJECTION_ERROR',
        StorageError: 'STORAGE_ERROR',
        ValidationError: 'VALIDATION_ERROR'
      };

      const errors = [
        new DatabaseLoadError('DB'),
        new GameNotFoundError('Game'),
        new LowConfidenceMatchError('Game', 50),
        new SteamPageDetectionError('Detection'),
        new DOMInjectionError('Injection'),
        new StorageError('Storage'),
        new ValidationError('Validation')
      ];

      errors.forEach(error => {
        const code = getErrorCode(error);
        expect(code).toBe(expectedCodes[error.name]);
      });
    });
  });

  describe('Error Inheritance Chain', () => {
    test('all custom errors should be instances of Error', () => {
      const errors = [
        new DatabaseLoadError('DB'),
        new GameNotFoundError('Game'),
        new LowConfidenceMatchError('Game', 50),
        new SteamPageDetectionError('Detection'),
        new DOMInjectionError('Injection'),
        new StorageError('Storage'),
        new ValidationError('Validation')
      ];

      errors.forEach(error => {
        expect(error instanceof Error).toBe(true);
        expect(error instanceof HLTBError).toBe(true);
      });
    });

    test('error names should match class names', () => {
      const errors = [
        { instance: new DatabaseLoadError('DB'), name: 'DatabaseLoadError' },
        { instance: new GameNotFoundError('Game'), name: 'GameNotFoundError' },
        { instance: new LowConfidenceMatchError('Game', 50), name: 'LowConfidenceMatchError' },
        { instance: new SteamPageDetectionError('Detection'), name: 'SteamPageDetectionError' },
        { instance: new DOMInjectionError('Injection'), name: 'DOMInjectionError' },
        { instance: new StorageError('Storage'), name: 'StorageError' },
        { instance: new ValidationError('Validation'), name: 'ValidationError' }
      ];

      errors.forEach(({ instance, name }) => {
        expect(instance.name).toBe(name);
      });
    });
  });
});
