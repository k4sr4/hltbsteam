import { HLTBIntegratedService } from './services/hltb-integrated-service';

export class MessageHandler {
  constructor(private hltbService: HLTBIntegratedService) {}

  async handle(request: any, sender: chrome.runtime.MessageSender) {
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

      default:
        throw new Error(`Unknown action: ${request.action}`);
    }
  }

  private async handleFetchHLTB(request: any) {
    const { gameTitle, appId } = request;

    if (!gameTitle) {
      return { success: false, error: 'Game title is required' };
    }

    if (appId && (typeof appId !== 'string' || !/^\d+$/.test(appId))) {
      return { success: false, error: 'Invalid app ID' };
    }

    if (typeof gameTitle !== 'string' || gameTitle.length > 200) {
      return { success: false, error: 'Invalid game title' };
    }

    try {
      const data = await this.hltbService.getGameData(gameTitle, appId);
      return { success: true, data };
    } catch (error) {
      console.error('[HLTB] Fetch error:', error);
      return { success: false, error: (error as Error).message };
    }
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
    try {
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
    } catch (error) {
      console.error('[HLTB] Error getting database info:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}