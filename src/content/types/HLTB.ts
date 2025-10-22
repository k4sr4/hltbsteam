/**
 * TypeScript interfaces for HLTB UI components
 */

/**
 * HLTB game data from background service
 */
export interface HLTBData {
  /** Main story completion time in hours */
  mainStory: number | null;

  /** Main + extras completion time in hours */
  mainExtra: number | null;

  /** 100% completion time in hours */
  completionist: number | null;

  /** All playstyles average time in hours */
  allStyles?: number | null;

  /** HLTB game ID for linking */
  gameId?: number | string;

  /** Data source indicator */
  source?: DataSource;

  /** Confidence level of the data */
  confidence?: ConfidenceLevel;
}

/**
 * Data source types
 */
export type DataSource = 'api' | 'cache' | 'scraper' | 'fallback' | 'database';

/**
 * Confidence levels for data accuracy
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Component display state
 */
export enum DisplayState {
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  NO_DATA = 'no_data'
}

/**
 * Component theme configuration
 */
export interface ThemeConfig {
  /** Theme mode */
  mode: 'light' | 'dark' | 'auto';

  /** Custom color overrides */
  colors?: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
    border?: string;
  };
}

/**
 * Component configuration options
 */
export interface HLTBDisplayConfig {
  /** Enable animations */
  enableAnimations?: boolean;

  /** Show loading spinner */
  showLoading?: boolean;

  /** Show error messages */
  showErrors?: boolean;

  /** Theme configuration */
  theme?: ThemeConfig;

  /** Custom CSS classes */
  customClasses?: string[];

  /** Accessibility features enabled */
  accessibility?: boolean;

  /** Link to HLTB website */
  enableLink?: boolean;

  /** Show data source indicator */
  showSource?: boolean;
}

/**
 * Injection point configuration
 */
export interface InjectionPoint {
  /** CSS selector for target element */
  selector: string;

  /** Position relative to target */
  position: 'before' | 'after' | 'prepend' | 'append';

  /** Priority (lower = higher priority) */
  priority: number;

  /** Optional condition function */
  condition?: () => boolean;
}

/**
 * Component performance metrics
 */
export interface ComponentMetrics {
  /** Time to create component (ms) */
  creationTime: number;

  /** Time to inject component (ms) */
  injectionTime: number;

  /** Time to render data (ms) */
  renderTime: number;

  /** Total time (ms) */
  totalTime: number;

  /** DOM operations count */
  domOperations: number;

  /** Shadow DOM overhead (ms) */
  shadowDOMTime?: number;
}

/**
 * Component lifecycle callbacks
 */
export interface ComponentCallbacks {
  /** Called before component creation */
  onBeforeCreate?: () => void;

  /** Called after component created */
  onCreate?: () => void;

  /** Called before injection */
  onBeforeInject?: () => void;

  /** Called after injection */
  onInject?: () => void;

  /** Called on data update */
  onUpdate?: (data: HLTBData) => void;

  /** Called on error */
  onError?: (error: Error) => void;

  /** Called on destroy */
  onDestroy?: () => void;
}
