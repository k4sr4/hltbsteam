import { HLTBIntegratedService } from './services/hltb-integrated-service';
import {
  ErrorHandler,
  ValidationError,
  safeExecute
} from '../shared';

export class MessageHandler {
  private errorHandler: ErrorHandler;

  constructor(private hltbService: HLTBIntegratedService) {
    this.errorHandler = ErrorHandler.getInstance({
      enableConsoleLogging: true,
      enableStoragePersistence: true,
      enableErrorReporting: process.env.NODE_ENV === 'production'
    });
  }

  async handle(request: any, sender: chrome.runtime.MessageSender) {
    return safeExecute(
      async () => {
        switch (request.action) {
          case 'fetchHLTB':
            return this.handleFetchHLTB(request);

          case 'clearCache':
            return this.handleClearCache();

          case 'getCacheStats':
            return this.handleGetCacheStats();

          case 'batchFetch':
            return this.handleBatchFetch(request);

          case 'getSettings':
            return this.handleGetSettings();

          case 'getDiagnostics':
            return this.handleGetDiagnostics();

          case 'getStats':
            return this.handleGetStats();

          case 'healthCheck':
            return this.handleHealthCheck();

          case 'getDatabaseInfo':
            return this.handleGetDatabaseInfo();

          case 'getErrorLog':
            return this.handleGetErrorLog();

          case 'clearErrorLog':
            return this.handleClearErrorLog();

          default:
            throw new ValidationError(`Unknown action: ${request.action}`);
        }
      },
      { success: false, error: 'Internal error occurred' },
      (error) => this.errorHandler.handleError(error)
    );
  }

  private async handleFetchHLTB(request: any) {
    const { gameTitle, appId } = request;

    // Validation with generic error messages (security best practice)
    if (!gameTitle || typeof gameTitle !== 'string') {
      throw new ValidationError('Invalid request parameters', 'gameTitle');
    }

    if (gameTitle.length === 0 || gameTitle.length > 200) {
      throw new ValidationError('Invalid request parameters', 'gameTitle');
    }

    if (appId && (typeof appId !== 'string' || !/^\d+$/.test(appId))) {
      throw new ValidationError('Invalid request parameters', 'appId');
    }

    // Log validation details only in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('[HLTB] Validated request:', { gameTitle: gameTitle.substring(0, 50), appId });
    }

    const data = await this.hltbService.getGameData(gameTitle, appId);
    return { success: true, data };
  }

  private async handleClearCache() {
    const cleared = await this.hltbService.clearCache();
    return { success: true, message: `Cache cleared (${cleared} entries)` };
  }

  private async handleGetCacheStats() {
    const diagnostics = await this.hltbService.getDiagnostics();
    return { success: true, data: diagnostics.cache };
  }

  private async handleGetSettings() {
    try {
      const settings = await chrome.storage.local.get(['enabled', 'cacheEnabled', 'theme', 'cacheDurationHours']);
      return {
        success: true,
        settings: {
          enabled: settings.enabled !== false,
          cacheEnabled: settings.cacheEnabled !== false,
          theme: settings.theme || 'auto',
          cacheDurationHours: settings.cacheDurationHours || 168
        }
      };
    } catch (error) {
      console.error('[HLTB] Error getting settings:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleBatchFetch(request: any) {
    const { games } = request;

    if (!Array.isArray(games)) {
      return { success: false, error: 'Games array is required' };
    }

    const results = await this.hltbService.batchFetch(games);
    return { success: true, data: results };
  }

  private async handleGetDiagnostics() {
    try {
      const diagnostics = await this.hltbService.getDiagnostics();
      return { success: true, data: diagnostics };
    } catch (error) {
      console.error('[HLTB] Error getting diagnostics:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetStats() {
    try {
      const stats = this.hltbService.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('[HLTB] Error getting stats:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleHealthCheck() {
    try {
      const health = await this.hltbService.healthCheck();
      return { success: true, data: health };
    } catch (error) {
      console.error('[HLTB] Error checking health:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async handleGetDatabaseInfo() {
    // Import fallback data to get database info
    const fallbackData = await import('./services/fallback-data.json');

    return {
      success: true,
      data: {
        version: fallbackData.version || '1.0.0',
        gameCount: fallbackData.games?.length || 0,
        lastUpdated: fallbackData.lastUpdated || new Date().toISOString()
      }
    };
  }

  private async handleGetErrorLog() {
    const errorLog = this.errorHandler.getErrorLog();
    return {
      success: true,
      data: errorLog
    };
  }

  private async handleClearErrorLog() {
    this.errorHandler.clearErrorLog();
    return {
      success: true,
      message: 'Error log cleared'
    };
  }
}