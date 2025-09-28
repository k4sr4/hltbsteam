import { HLTBService } from './services/hltb-service';

export class MessageHandler {
  constructor(private hltbService: HLTBService) {}

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
    await chrome.storage.local.remove(['hltb_cache']);
    return { success: true, message: 'Cache cleared' };
  }

  private async handleGetCacheStats() {
    const stats = await this.hltbService.getCacheStats();
    return { success: true, data: stats };
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
}