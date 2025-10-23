/**
 * Custom Error Classes for HLTB Steam Extension
 *
 * Provides specific error types for different failure scenarios
 * with user-friendly messages and recovery information.
 */

/**
 * Base error class for all HLTB-specific errors
 */
export class HLTBError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'HLTBError';

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when the HLTB database fails to load
 * This is a critical error that prevents the extension from functioning
 */
export class DatabaseLoadError extends HLTBError {
  constructor(message: string, public originalError?: Error) {
    super(
      message,
      'DATABASE_LOAD_ERROR',
      false, // Not recoverable - need to reinstall
      'Failed to load HLTB database. Extension may not work properly.'
    );
    this.name = 'DatabaseLoadError';
  }
}

/**
 * Error thrown when a game is not found in the database
 * This is a recoverable error - we can log it for future database expansion
 */
export class GameNotFoundError extends HLTBError {
  constructor(public gameTitle: string) {
    super(
      `Game not found in database: ${gameTitle}`,
      'GAME_NOT_FOUND',
      true,
      `No completion time data available for "${gameTitle}". Help us expand the database!`
    );
    this.name = 'GameNotFoundError';
  }
}

/**
 * Error thrown when fuzzy matching confidence is below threshold
 * This is a warning-level error - we found a match but it might not be accurate
 */
export class LowConfidenceMatchError extends HLTBError {
  constructor(public gameTitle: string, public confidence: number) {
    super(
      `Low confidence match for ${gameTitle}: ${confidence}%`,
      'LOW_CONFIDENCE',
      true,
      `Fuzzy match found but confidence is low (${confidence}%). Results may not be accurate.`
    );
    this.name = 'LowConfidenceMatchError';
  }
}

/**
 * Error thrown when unable to detect game information from Steam page
 * This is recoverable - we can try alternative detection strategies
 */
export class SteamPageDetectionError extends HLTBError {
  constructor(message: string, public detectionAttempts?: number) {
    super(
      message,
      'PAGE_DETECTION_ERROR',
      true,
      'Unable to detect game information on this Steam page.'
    );
    this.name = 'SteamPageDetectionError';
  }
}

/**
 * Error thrown when UI component injection fails
 * This is recoverable - we can try alternative injection points
 */
export class DOMInjectionError extends HLTBError {
  constructor(message: string, public attemptedSelectors?: string[]) {
    super(
      message,
      'DOM_INJECTION_ERROR',
      true,
      'Unable to display HLTB data on this page.'
    );
    this.name = 'DOMInjectionError';
  }
}

/**
 * Error thrown when Chrome storage operations fail
 * This is recoverable - we can clear cache or retry
 */
export class StorageError extends HLTBError {
  constructor(message: string, public operation?: 'get' | 'set' | 'remove' | 'clear') {
    super(
      message,
      'STORAGE_ERROR',
      true,
      'Cache storage issue. Some features may be limited.'
    );
    this.name = 'StorageError';
  }
}

/**
 * Error thrown when data validation fails
 * This is not recoverable - indicates corrupted or invalid data
 */
export class ValidationError extends HLTBError {
  constructor(message: string, public field?: string) {
    super(
      message,
      'VALIDATION_ERROR',
      false,
      'Invalid data detected.'
    );
    this.name = 'ValidationError';
  }
}

/**
 * Type guard to check if error is an HLTBError
 */
export function isHLTBError(error: unknown): error is HLTBError {
  return error instanceof HLTBError;
}

/**
 * Type guard to check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  return isHLTBError(error) && error.recoverable;
}

/**
 * Get user-friendly error message from any error
 */
export function getUserMessage(error: unknown): string {
  if (isHLTBError(error) && error.userMessage) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): string {
  if (isHLTBError(error)) {
    return error.code;
  }

  if (error instanceof Error) {
    return error.name;
  }

  return 'UNKNOWN_ERROR';
}
