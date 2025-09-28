/**
 * Main entry point for the enhanced content script system
 * Exports all components for use in compiled content script
 */

// Core components
export { SteamPageDetector } from './detection/SteamPageDetector';
export { NavigationObserver, GlobalNavigationObserver } from './navigation/NavigationObserver';
export { StateManager, GlobalStateManager } from './managers/StateManager';
export { DomUtils } from './utils/DomUtils';
export { ContentScript } from './ContentScript';

// Types
export * from './types';

// For backward compatibility with existing content.js
export { ContentScript as default } from './ContentScript';