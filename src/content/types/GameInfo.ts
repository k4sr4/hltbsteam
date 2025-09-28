/**
 * TypeScript interfaces for Steam page detection and game information
 */

export enum SteamPageType {
  GAME = 'game',
  DLC = 'dlc',
  BUNDLE = 'bundle',
  DEMO = 'demo',
  SOFTWARE = 'software',
  UNKNOWN = 'unknown'
}

export enum SteamPageSource {
  STORE = 'store',
  COMMUNITY = 'community',
  LIBRARY = 'library'
}

export interface GameInfo {
  /** Steam application ID */
  appId: string;

  /** Game title extracted from various sources */
  title: string;

  /** Type of Steam page (game, DLC, bundle, etc.) */
  pageType: SteamPageType;

  /** Source of the Steam page (store, community, library) */
  pageSource: SteamPageSource;

  /** URL of the current page */
  url: string;

  /** Title extraction method used */
  titleSource: TitleExtractionMethod;

  /** Additional metadata based on page type */
  metadata?: GameMetadata;

  /** Timestamp when info was extracted */
  extractedAt: number;
}

export enum TitleExtractionMethod {
  OG_TITLE = 'og:title',
  PAGE_TITLE = 'page_title',
  APP_NAME_ELEMENT = 'app_name_element',
  BREADCRUMB = 'breadcrumb',
  JSON_LD = 'json_ld',
  FALLBACK = 'fallback'
}

export interface GameMetadata {
  /** Developer/Publisher information */
  developer?: string;
  publisher?: string;

  /** Release date if available */
  releaseDate?: string;

  /** Price information for store pages */
  price?: PriceInfo;

  /** Parent app ID for DLC */
  parentAppId?: string;

  /** Bundle contents for bundles */
  bundleItems?: string[];

  /** Steam tags/genres */
  tags?: string[];
}

export interface PriceInfo {
  /** Current price in cents */
  current?: number;

  /** Original price in cents */
  original?: number;

  /** Currency code */
  currency?: string;

  /** Whether on sale */
  onSale?: boolean;

  /** Discount percentage */
  discountPercent?: number;
}

/**
 * Configuration for the Steam page detector
 */
export interface DetectorConfig {
  /** Maximum time to wait for content to load (ms) */
  maxWaitTime: number;

  /** Interval for checking content loading (ms) */
  checkInterval: number;

  /** Whether to enable debug logging */
  debug: boolean;

  /** Custom selectors for title extraction */
  customSelectors?: Record<string, string>;

  /** URL patterns to exclude from detection */
  excludePatterns?: RegExp[];
}

/**
 * Result of page detection attempt
 */
export interface DetectionResult {
  /** Whether detection was successful */
  success: boolean;

  /** Game information if successful */
  gameInfo?: GameInfo;

  /** Error message if unsuccessful */
  error?: string;

  /** Time taken for detection (ms) */
  detectionTime: number;

  /** Whether content was still loading */
  contentLoading?: boolean;
}

/**
 * Navigation state for SPA handling
 */
export interface NavigationState {
  /** Current URL */
  currentUrl: string;

  /** Previous URL */
  previousUrl?: string;

  /** Whether navigation is in progress */
  navigating: boolean;

  /** Current game info if any */
  currentGameInfo?: GameInfo;

  /** Timestamp of last navigation */
  lastNavigationTime: number;
}

/**
 * Observer configuration for navigation monitoring
 */
export interface ObserverConfig {
  /** Whether to debounce navigation events */
  debounce: boolean;

  /** Debounce delay in milliseconds */
  debounceDelay: number;

  /** Maximum number of mutations to process per batch */
  maxMutationBatch: number;

  /** Specific elements to observe for changes */
  targetSelectors?: string[];
}

/**
 * Extension state management
 */
export interface ExtensionState {
  /** Whether extension is enabled */
  enabled: boolean;

  /** Current game information */
  currentGame?: GameInfo;

  /** Previous game information */
  previousGame?: GameInfo;

  /** Navigation state */
  navigation: NavigationState;

  /** Detection state */
  detection: DetectionState;

  /** UI state */
  ui: UIState;

  /** Performance metrics */
  metrics: PerformanceMetrics;
}

/**
 * Detection state
 */
export interface DetectionState {
  /** Whether detection is in progress */
  inProgress: boolean;

  /** Number of consecutive failures */
  failureCount: number;

  /** Last detection result */
  lastResult?: DetectionResult;

  /** Last successful detection timestamp */
  lastSuccessTime?: number;

  /** Retry timeout ID */
  retryTimeoutId?: number;
}

/**
 * UI state
 */
export interface UIState {
  /** Whether UI is displayed */
  displayed: boolean;

  /** Container element reference */
  containerElement?: HTMLElement;

  /** Whether injection is in progress */
  injecting: boolean;

  /** Last error message */
  lastError?: string;

  /** UI theme preference */
  theme: 'light' | 'dark' | 'auto';
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Total detection attempts */
  totalDetections: number;

  /** Successful detections */
  successfulDetections: number;

  /** Average detection time */
  averageDetectionTime: number;

  /** Memory usage estimate */
  memoryUsage: number;

  /** Last performance check timestamp */
  lastCheckTime: number;
}