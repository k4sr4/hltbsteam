/**
 * Shared utilities and error handling for HLTB Steam Extension
 */

// Export all error classes
export {
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
} from './errors';

// Export error handler
export {
  ErrorHandler,
  getErrorHandler,
  type ErrorLogEntry,
  type ErrorHandlerConfig
} from './error-handler';

// Export safe execution utilities
export {
  safeExecute,
  safeExecuteSync,
  withErrorBoundary,
  withSafeErrorBoundary,
  retryWithBackoff,
  withTimeout,
  batchExecute,
  debounce,
  memoize
} from './safe-execute';
