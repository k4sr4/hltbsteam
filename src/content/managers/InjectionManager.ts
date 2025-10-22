/**
 * InjectionManager - Manages HLTB component injection into Steam pages
 *
 * Responsibilities:
 * - Finding optimal injection points on Steam pages
 * - Managing component lifecycle
 * - Handling re-injection on navigation
 * - Cleanup and memory management
 */

import { HLTBDisplay, createHLTBDisplay } from '../components/HLTBDisplay';
import {
  HLTBData,
  HLTBDisplayConfig,
  InjectionPoint,
  ComponentCallbacks
} from '../types/HLTB';

/**
 * Configuration for the injection manager
 */
export interface InjectionManagerConfig {
  /** Display component configuration */
  displayConfig?: HLTBDisplayConfig;

  /** Custom injection points (higher priority than defaults) */
  customInjectionPoints?: InjectionPoint[];

  /** Auto re-inject on DOM changes */
  autoReinject?: boolean;

  /** Debug logging */
  debug?: boolean;

  /** Component lifecycle callbacks */
  callbacks?: ComponentCallbacks;
}

/**
 * Default injection points for Steam pages
 * Using fixed positioning to avoid Steam's dynamic content replacement
 */
const DEFAULT_INJECTION_POINTS: InjectionPoint[] = [
  // MOST STABLE - Append to body with fixed positioning
  // This is outside Steam's content areas entirely
  {
    selector: 'body',
    position: 'append',
    priority: 1,
    condition: () => document.body !== null
  }
];

/**
 * Manages injection of HLTB display component into Steam pages
 */
export class InjectionManager {
  private display: HLTBDisplay | null = null;
  private currentInjectionPoint: Element | null = null;
  private mutationObserver: MutationObserver | null = null;
  private config: InjectionManagerConfig;
  private isDestroyed = false;

  /**
   * Create a new injection manager
   */
  constructor(config: InjectionManagerConfig = {}) {
    this.config = {
      autoReinject: true,
      debug: false,
      ...config
    };

    this.log('InjectionManager initialized', this.config);
  }

  /**
   * Inject HLTB data into the Steam page
   *
   * @param data - HLTB completion time data
   * @param gameTitle - Optional game title for debugging
   * @returns true if injection was successful
   */
  async injectHLTBData(data: HLTBData, gameTitle?: string): Promise<boolean> {
    try {
      this.log('Starting injection', { data, gameTitle });

      // Clean up any existing display
      this.cleanup();

      // Find optimal injection point
      const injectionPoint = this.findInjectionPoint();
      if (!injectionPoint) {
        console.error('[HLTB] No suitable injection target found');
        this.log('No injection point found');
        return false;
      }

      this.log('Found injection point:', injectionPoint.element.className);
      this.currentInjectionPoint = injectionPoint.element;

      // Create display component
      this.display = createHLTBDisplay(
        this.config.displayConfig,
        this.config.callbacks
      );

      // Mount component
      this.display.mount(injectionPoint.element, injectionPoint.position);

      // Update with data
      if (data && this.hasValidData(data)) {
        this.display.setData(data);
      } else {
        // Show error for missing data
        this.display.setError('No completion time data available for this game');
      }

      // Set up auto-reinject if enabled
      if (this.config.autoReinject) {
        this.setupReinjectObserver();
      }

      this.log('Injection successful');
      return true;

    } catch (error) {
      console.error('[HLTB] Injection error:', error);
      this.log('Injection failed', error);
      return false;
    }
  }

  /**
   * Show loading state
   */
  showLoading(): void {
    if (this.display) {
      this.display.setLoading();
      this.log('Showing loading state');
    }
  }

  /**
   * Show error state
   */
  showError(error: string | Error): void {
    if (this.display) {
      this.display.setError(error);
      this.log('Showing error state', error);
    }
  }

  /**
   * Update data in existing display
   */
  updateData(data: HLTBData): void {
    if (this.display) {
      this.display.setData(data);
      this.log('Data updated');
    }
  }

  /**
   * Get component performance metrics
   */
  getMetrics() {
    return this.display?.getMetrics() || null;
  }

  /**
   * Clean up current display and observers
   */
  cleanup(): void {
    this.log('Cleaning up injection manager');

    // Destroy display component
    if (this.display) {
      this.display.destroy();
      this.display = null;
    }

    // Disconnect mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    this.currentInjectionPoint = null;
  }

  /**
   * Destroy the injection manager completely
   */
  destroy(): void {
    this.cleanup();
    this.isDestroyed = true;
    this.log('InjectionManager destroyed');
  }

  /**
   * Check if manager has been destroyed
   */
  isActive(): boolean {
    return !this.isDestroyed;
  }

  /**
   * Find the optimal injection point based on priority
   *
   * @returns Injection point details or null if none found
   */
  private findInjectionPoint(): { element: Element; position: InsertPosition } | null {
    // Combine custom and default injection points
    const allPoints = [
      ...(this.config.customInjectionPoints || []),
      ...DEFAULT_INJECTION_POINTS
    ];

    // Sort by priority (lower number = higher priority)
    allPoints.sort((a, b) => a.priority - b.priority);

    // Find first valid injection point
    for (const point of allPoints) {
      // Check condition if provided
      if (point.condition && !point.condition()) {
        continue;
      }

      const element = document.querySelector(point.selector);
      if (element) {
        this.log('Selected injection point:', {
          selector: point.selector,
          position: point.position,
          priority: point.priority
        });

        return {
          element,
          position: this.mapPosition(point.position)
        };
      }
    }

    return null;
  }

  /**
   * Map InjectionPoint position to InsertPosition
   */
  private mapPosition(position: 'before' | 'after' | 'prepend' | 'append'): InsertPosition {
    switch (position) {
      case 'before':
        return 'beforebegin';
      case 'after':
        return 'afterend';
      case 'prepend':
        return 'afterbegin';
      case 'append':
        return 'beforeend';
      default:
        return 'beforebegin';
    }
  }

  /**
   * Check if HLTB data has any valid values
   */
  private hasValidData(data: HLTBData): boolean {
    return !!(
      data.mainStory !== null ||
      data.mainExtra !== null ||
      data.completionist !== null ||
      data.allStyles !== null
    );
  }

  /**
   * Set up mutation observer to detect when component is removed
   * and re-inject if needed
   */
  private setupReinjectObserver(): void {
    if (!this.display || !this.currentInjectionPoint) {
      return;
    }

    // Disconnect existing observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    // Create new observer
    this.mutationObserver = new MutationObserver((mutations) => {
      // Check if our display is still in the DOM
      const displayHost = document.querySelector('.hltb-display-host');

      if (!displayHost && this.display && !this.isDestroyed) {
        this.log('Display removed from DOM, attempting re-injection');
        // Re-inject if display was removed
        // Note: We don't have the data here, so this would need to be
        // handled by the content script to fetch data again
        console.warn('[HLTB] Display component was removed from DOM. Content script should handle re-injection.');
      }
    });

    // Observe the parent element for changes
    const observeTarget = this.currentInjectionPoint.parentElement || document.body;
    this.mutationObserver.observe(observeTarget, {
      childList: true,
      subtree: true
    });

    this.log('Reinject observer set up');
  }

  /**
   * Debug logging helper
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      if (data !== undefined) {
        console.log(`[HLTB InjectionManager] ${message}`, data);
      } else {
        console.log(`[HLTB InjectionManager] ${message}`);
      }
    }
  }
}

/**
 * Factory function to create an injection manager
 */
export function createInjectionManager(config?: InjectionManagerConfig): InjectionManager {
  return new InjectionManager(config);
}
