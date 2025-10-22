/**
 * Test Data Factories
 *
 * Factory functions for creating mock test data with sensible defaults
 * and easy customization through partial overrides.
 */

import {
  HLTBData,
  HLTBDisplayConfig,
  DisplayState,
  ThemeConfig,
  ComponentMetrics,
  ComponentCallbacks,
  InjectionPoint
} from '../../src/content/types/HLTB';

/**
 * Creates mock HLTB data with sensible defaults
 *
 * @param overrides - Partial data to override defaults
 * @returns Complete HLTBData object
 *
 * @example
 * const data = createMockHLTBData({ mainStory: 10 });
 */
export function createMockHLTBData(overrides?: Partial<HLTBData>): HLTBData {
  return {
    mainStory: 12,
    mainExtra: 18,
    completionist: 25,
    allStyles: 15,
    gameId: 12345,
    source: 'api',
    confidence: 'high',
    ...overrides
  };
}

/**
 * Creates mock HLTB data with null values (no data scenario)
 */
export function createMockNoData(overrides?: Partial<HLTBData>): HLTBData {
  return {
    mainStory: null,
    mainExtra: null,
    completionist: null,
    allStyles: null,
    source: 'fallback',
    ...overrides
  };
}

/**
 * Creates mock HLTB data with partial values
 */
export function createMockPartialData(overrides?: Partial<HLTBData>): HLTBData {
  return {
    mainStory: 12,
    mainExtra: null,
    completionist: null,
    allStyles: null,
    gameId: 12345,
    source: 'scraper',
    confidence: 'medium',
    ...overrides
  };
}

/**
 * Creates mock display configuration
 */
export function createMockDisplayConfig(
  overrides?: Partial<HLTBDisplayConfig>
): Required<HLTBDisplayConfig> {
  return {
    enableAnimations: true,
    showLoading: true,
    showErrors: true,
    theme: {
      mode: 'dark',
      colors: {
        primary: '#66c0f4',
        secondary: '#8b98a5',
        background: '#2a475e',
        text: '#c7d5e0',
        border: '#000000'
      }
    },
    customClasses: [],
    accessibility: true,
    enableLink: true,
    showSource: true,
    ...overrides
  };
}

/**
 * Creates mock theme configuration
 */
export function createMockThemeConfig(overrides?: Partial<ThemeConfig>): ThemeConfig {
  return {
    mode: 'dark',
    colors: {
      primary: '#66c0f4',
      secondary: '#8b98a5',
      background: '#2a475e',
      text: '#c7d5e0',
      border: '#000000'
    },
    ...overrides
  };
}

/**
 * Creates mock component callbacks
 */
export function createMockCallbacks(overrides?: Partial<ComponentCallbacks>): ComponentCallbacks {
  return {
    onBeforeCreate: jest.fn(),
    onCreate: jest.fn(),
    onBeforeInject: jest.fn(),
    onInject: jest.fn(),
    onUpdate: jest.fn(),
    onError: jest.fn(),
    onDestroy: jest.fn(),
    ...overrides
  };
}

/**
 * Creates mock component metrics
 */
export function createMockMetrics(overrides?: Partial<ComponentMetrics>): ComponentMetrics {
  return {
    creationTime: 5,
    injectionTime: 15,
    renderTime: 10,
    totalTime: 30,
    domOperations: 8,
    shadowDOMTime: 3,
    ...overrides
  };
}

/**
 * Creates mock game info
 */
export interface GameInfo {
  appId: string;
  title: string;
}

export function createMockGameInfo(overrides?: Partial<GameInfo>): GameInfo {
  return {
    appId: '12345',
    title: 'Test Game',
    ...overrides
  };
}

/**
 * Creates mock injection point
 */
export function createMockInjectionPoint(overrides?: Partial<InjectionPoint>): InjectionPoint {
  return {
    selector: '.game_area_purchase',
    position: 'before',
    priority: 1,
    condition: () => true,
    ...overrides
  };
}

/**
 * Creates mock Chrome message response
 */
export interface MessageResponse {
  success: boolean;
  data?: HLTBData;
  error?: string;
  settings?: {
    enabled: boolean;
    cacheEnabled?: boolean;
    theme?: string;
  };
  cleared?: number;
}

export function createMockMessageResponse(
  overrides?: Partial<MessageResponse>
): MessageResponse {
  return {
    success: true,
    data: createMockHLTBData(),
    ...overrides
  };
}

/**
 * Creates mock error response
 */
export function createMockErrorResponse(error: string = 'Test error'): MessageResponse {
  return {
    success: false,
    error
  };
}

/**
 * Creates mock settings response
 */
export function createMockSettingsResponse(
  enabled: boolean = true
): MessageResponse {
  return {
    success: true,
    settings: {
      enabled,
      cacheEnabled: true,
      theme: 'auto'
    }
  };
}

/**
 * Creates mock cache entry
 */
export interface CacheEntry {
  data: HLTBData;
  timestamp: number;
  gameTitle: string;
}

export function createMockCacheEntry(
  overrides?: Partial<CacheEntry>
): CacheEntry {
  return {
    data: createMockHLTBData(),
    timestamp: Date.now(),
    gameTitle: 'Test Game',
    ...overrides
  };
}

/**
 * Creates expired cache entry (>7 days old)
 */
export function createExpiredCacheEntry(
  overrides?: Partial<CacheEntry>
): CacheEntry {
  return {
    data: createMockHLTBData(),
    timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
    gameTitle: 'Test Game',
    ...overrides
  };
}

/**
 * Array of realistic game data for testing
 */
export const REALISTIC_GAME_DATA = [
  { appId: '620', title: 'Portal 2', mainStory: 8, mainExtra: 11, completionist: 15 },
  { appId: '440', title: 'Team Fortress 2', mainStory: null, mainExtra: null, completionist: null },
  { appId: '730', title: 'Counter-Strike 2', mainStory: null, mainExtra: null, completionist: null },
  { appId: '570', title: 'Dota 2', mainStory: null, mainExtra: null, completionist: null },
  { appId: '1145360', title: 'Hades II', mainStory: 15, mainExtra: 25, completionist: 40 },
  { appId: '1086940', title: 'Baldur\'s Gate 3', mainStory: 54, mainExtra: 95, completionist: 139 },
  { appId: '1174180', title: 'Red Dead Redemption 2', mainStory: 50, mainExtra: 79, completionist: 173 }
];
