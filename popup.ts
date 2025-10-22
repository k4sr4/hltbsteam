/**
 * HLTB Steam Extension - Popup Controller
 * Manages popup interface, settings, statistics, and user actions
 */

interface ExtensionSettings {
  enabled: boolean;
  cacheEnabled: boolean;
  cacheDuration: number;
  displayPosition: 'above-purchase' | 'game-details' | 'sidebar';
  theme: 'auto' | 'dark' | 'light';
}

interface DatabaseInfo {
  version: string;
  gameCount: number;
  lastUpdated: string;
}

interface MatchStatistics {
  totalMatches: number;
  matchRate: number;
}

interface PopupStatistics {
  database: DatabaseInfo;
  matches: MatchStatistics;
}

type FeedbackType = 'success' | 'error' | 'info';

class PopupController {
  private elements: Map<string, HTMLElement> = new Map();
  private readonly DEFAULT_SETTINGS: ExtensionSettings = {
    enabled: true,
    cacheEnabled: true,
    cacheDuration: 7,
    displayPosition: 'above-purchase',
    theme: 'auto'
  };

  constructor() {
    this.cacheElements();
  }

  /**
   * Initialize popup - called on DOMContentLoaded
   */
  async initialize(): Promise<void> {
    try {
      // Parallel initialization for speed
      await Promise.all([
        this.initializeUI(),
        this.loadSettings(),
        this.loadStatistics()
      ]);

      this.attachEventListeners();
    } catch (error) {
      console.error('[Popup] Initialization failed:', error);
      this.showFeedback('Failed to initialize popup', 'error');
    }
  }

  /**
   * Cache DOM elements for performance
   */
  private cacheElements(): void {
    const ids = [
      'version',
      'enabled',
      'cache-enabled',
      'cache-duration',
      'display-position',
      'theme',
      'db-version',
      'db-games',
      'matches-count',
      'match-rate',
      'clear-cache',
      'refresh-current',
      'github-link',
      'report-issue',
      'suggest-game'
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      }
    }
  }

  /**
   * Get cached element by ID
   */
  private getElement(id: string): HTMLElement | null {
    return this.elements.get(id) || null;
  }

  /**
   * Initialize UI with version and theme
   */
  private async initializeUI(): Promise<void> {
    // Set version from manifest
    const manifest = chrome.runtime.getManifest();
    const versionElement = this.getElement('version');
    if (versionElement) {
      versionElement.textContent = `v${manifest.version}`;
    }
  }

  /**
   * Load all settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get([
        'enabled',
        'cacheEnabled',
        'cacheDuration',
        'displayPosition',
        'theme'
      ]);

      const settings: ExtensionSettings = {
        enabled: stored.enabled !== false,
        cacheEnabled: stored.cacheEnabled !== false,
        cacheDuration: stored.cacheDuration || this.DEFAULT_SETTINGS.cacheDuration,
        displayPosition: stored.displayPosition || this.DEFAULT_SETTINGS.displayPosition,
        theme: stored.theme || this.DEFAULT_SETTINGS.theme
      };

      this.renderSettings(settings);
    } catch (error) {
      console.error('[Popup] Failed to load settings:', error);
      this.renderSettings(this.DEFAULT_SETTINGS);
    }
  }

  /**
   * Render settings to UI
   */
  private renderSettings(settings: ExtensionSettings): void {
    this.setCheckbox('enabled', settings.enabled);
    this.setCheckbox('cache-enabled', settings.cacheEnabled);
    this.setSelect('cache-duration', settings.cacheDuration.toString());
    this.setSelect('display-position', settings.displayPosition);
    this.setSelect('theme', settings.theme);
  }

  /**
   * Load statistics from background service
   */
  private async loadStatistics(): Promise<void> {
    try {
      const [dbInfo, matchStats] = await Promise.all([
        this.loadDatabaseInfo(),
        this.loadMatchStatistics()
      ]);

      this.renderStatistics({
        database: dbInfo,
        matches: matchStats
      });
    } catch (error) {
      console.error('[Popup] Failed to load statistics:', error);
    }
  }

  /**
   * Load database info from background
   */
  private async loadDatabaseInfo(): Promise<DatabaseInfo> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getDatabaseInfo'
      });

      if (response?.success && response.data) {
        return {
          version: response.data.version || '1.0.0',
          gameCount: response.data.gameCount || 0,
          lastUpdated: response.data.lastUpdated || new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('[Popup] Failed to load database info:', error);
    }

    return {
      version: '1.0.0',
      gameCount: 100,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Load match statistics from background
   */
  private async loadMatchStatistics(): Promise<MatchStatistics> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getStats'
      });

      if (response?.success && response.data) {
        const stats = response.data;
        const total = stats.totalRequests || 0;
        const successes = (stats.apiSuccesses || 0) +
                          (stats.scraperSuccesses || 0) +
                          (stats.fallbackSuccesses || 0);

        return {
          totalMatches: successes,
          matchRate: total > 0 ? successes / total : 0
        };
      }
    } catch (error) {
      console.error('[Popup] Failed to load match statistics:', error);
    }

    return {
      totalMatches: 0,
      matchRate: 0
    };
  }

  /**
   * Render statistics to UI
   */
  private renderStatistics(stats: PopupStatistics): void {
    this.setText('db-version', stats.database.version);
    this.setText('db-games', stats.database.gameCount.toString());
    this.setText('matches-count', stats.matches.totalMatches.toString());
    this.setText('match-rate', `${Math.round(stats.matches.matchRate * 100)}%`);
  }

  /**
   * Attach all event listeners
   */
  private attachEventListeners(): void {
    // Main toggle
    this.onToggleChange('enabled', async (checked) => {
      await chrome.storage.local.set({ enabled: checked });
      await this.updateIcon(checked);
      this.showFeedback(checked ? 'Extension enabled' : 'Extension disabled', 'success');
    });

    // Cache toggle
    this.onToggleChange('cache-enabled', async (checked) => {
      await chrome.storage.local.set({ cacheEnabled: checked });
      this.showFeedback(checked ? 'Cache enabled' : 'Cache disabled', 'info');
    });

    // Cache duration
    this.onSelectChange('cache-duration', async (value) => {
      await chrome.storage.local.set({ cacheDuration: parseInt(value) });
      this.showFeedback(`Cache duration set to ${value} days`, 'info');
    });

    // Display position
    this.onSelectChange('display-position', async (value) => {
      await chrome.storage.local.set({ displayPosition: value });
      this.showFeedback('Display position updated', 'info');
    });

    // Theme
    this.onSelectChange('theme', async (value) => {
      await chrome.storage.local.set({ theme: value });
      this.showFeedback(`Theme set to ${value}`, 'success');
    });

    // Clear cache button
    this.onButtonClick('clear-cache', async () => {
      await this.handleClearCache();
    });

    // Refresh current page button
    this.onButtonClick('refresh-current', async () => {
      await this.handleRefreshPage();
    });

    // GitHub link
    this.onLinkClick('github-link', () => {
      chrome.tabs.create({ url: 'https://github.com/yourusername/hltb-steam' });
    });

    // Report issue link
    this.onLinkClick('report-issue', () => {
      chrome.tabs.create({ url: 'https://github.com/yourusername/hltb-steam/issues/new' });
    });

    // Suggest game link
    this.onLinkClick('suggest-game', () => {
      chrome.tabs.create({ url: 'https://github.com/yourusername/hltb-steam/blob/master/ADDING_GAMES.md' });
    });
  }

  /**
   * Handle clear cache action
   */
  private async handleClearCache(): Promise<void> {
    const button = this.getElement('clear-cache') as HTMLButtonElement;
    if (!button) return;

    const originalText = button.textContent || 'Clear Cache';

    try {
      // Update button to processing state
      button.textContent = 'Clearing...';
      button.disabled = true;
      button.classList.add('btn-processing');

      const response = await chrome.runtime.sendMessage({
        action: 'clearCache'
      });

      if (response?.success) {
        button.classList.remove('btn-processing');
        button.classList.add('btn-success');
        button.textContent = 'Cache Cleared!';

        this.showFeedback(`Cleared ${response.cleared || 0} cache entries`, 'success');

        // Refresh statistics
        await this.loadStatistics();

        // Reset button after delay
        setTimeout(() => {
          button.classList.remove('btn-success');
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[Popup] Clear cache failed:', error);
      button.classList.remove('btn-processing');
      button.classList.add('btn-error');
      button.textContent = 'Failed';

      this.showFeedback('Failed to clear cache', 'error');

      setTimeout(() => {
        button.classList.remove('btn-error');
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }
  }

  /**
   * Handle refresh current page action
   */
  private async handleRefreshPage(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      const activeTab = tabs[0];

      if (!activeTab?.id) {
        this.showFeedback('No active tab found', 'error');
        return;
      }

      // Verify it's a Steam page
      if (!this.isSteamPage(activeTab.url)) {
        this.showFeedback('This action only works on Steam pages', 'info');
        return;
      }

      await chrome.tabs.reload(activeTab.id);

      // Close popup after reload
      window.close();
    } catch (error) {
      console.error('[Popup] Refresh page failed:', error);
      this.showFeedback('Failed to refresh page', 'error');
    }
  }

  /**
   * Check if URL is a Steam page
   */
  private isSteamPage(url?: string): boolean {
    if (!url) return false;
    return url.startsWith('https://store.steampowered.com/') ||
           url.startsWith('https://steamcommunity.com/');
  }

  /**
   * Update extension icon based on enabled state
   */
  private async updateIcon(enabled: boolean): Promise<void> {
    const iconSuffix = enabled ? '' : '-disabled';
    try {
      await chrome.action.setIcon({
        path: {
          '16': `icons/icon16${iconSuffix}.png`,
          '48': `icons/icon48${iconSuffix}.png`,
          '128': `icons/icon128${iconSuffix}.png`
        }
      });
    } catch (error) {
      console.error('[Popup] Failed to update icon:', error);
    }
  }

  /**
   * Show temporary feedback message
   */
  private showFeedback(message: string, type: FeedbackType, duration: number = 3000): void {
    const feedback = document.createElement('div');
    feedback.className = `feedback feedback-${type}`;
    feedback.textContent = message;
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    const container = document.querySelector('.popup-container');
    if (container && container.firstChild) {
      container.insertBefore(feedback, container.firstChild);

      // Animate in
      requestAnimationFrame(() => {
        feedback.classList.add('feedback-visible');
      });

      // Remove after duration
      setTimeout(() => {
        feedback.classList.remove('feedback-visible');
        setTimeout(() => feedback.remove(), 300);
      }, duration);
    }
  }

  // UI Helper Methods

  private setCheckbox(id: string, checked: boolean): void {
    const element = this.getElement(id) as HTMLInputElement;
    if (element && element.type === 'checkbox') {
      element.checked = checked;
    }
  }

  private setSelect(id: string, value: string): void {
    const element = this.getElement(id) as HTMLSelectElement;
    if (element && element.tagName === 'SELECT') {
      element.value = value;
    }
  }

  private setText(id: string, text: string): void {
    const element = this.getElement(id);
    if (element) {
      element.textContent = text;
    }
  }

  private onToggleChange(id: string, callback: (checked: boolean) => void): void {
    const element = this.getElement(id) as HTMLInputElement;
    if (element) {
      element.addEventListener('change', (e) => {
        callback((e.target as HTMLInputElement).checked);
      });
    }
  }

  private onSelectChange(id: string, callback: (value: string) => void): void {
    const element = this.getElement(id) as HTMLSelectElement;
    if (element) {
      element.addEventListener('change', (e) => {
        callback((e.target as HTMLSelectElement).value);
      });
    }
  }

  private onButtonClick(id: string, callback: () => Promise<void> | void): void {
    const element = this.getElement(id) as HTMLButtonElement;
    if (element) {
      element.addEventListener('click', async () => {
        await callback();
      });
    }
  }

  private onLinkClick(id: string, callback: () => void): void {
    const element = this.getElement(id) as HTMLAnchorElement;
    if (element) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        callback();
      });
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
  controller.initialize().catch((error) => {
    console.error('[Popup] Failed to initialize:', error);
  });
});
