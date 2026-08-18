import { MessageHandler } from './message-handler';
import { hltbIntegratedService } from './services/hltb-integrated-service';
import { ensureHltbHeaderRules } from './services/hltb-header-rules';
import { ErrorHandler } from '../shared';

// Install the Referer/Origin header rules for HLTB API requests as early as
// possible; the API client also awaits this before every request.
ensureHltbHeaderRules();

// Initialize global error handler for background service
const errorHandler = ErrorHandler.getInstance({
  enableConsoleLogging: true,
  enableStoragePersistence: true,
  enableErrorReporting: false // Set to true in production
});

const messageHandler = new MessageHandler(hltbIntegratedService);

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[HLTB] Extension installed:', details.reason);

  if (details.reason === 'install') {
    await chrome.storage.local.set({
      enabled: true,
      cacheEnabled: true,
      cacheDurationHours: 168,
      rateLimit: {
        maxRequests: 10,
        windowMs: 60000
      }
    });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    console.log('[HLTB] Updated from version:', previousVersion);

    // Old versions cached results sourced from the bundled fallback JSON;
    // clear once so live API data repopulates the cache.
    await hltbIntegratedService.clearCache();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[HLTB] Message received:', request.action);

  messageHandler
    .handle(request, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[HLTB] Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true;
});

const keepAlive = () => {
  chrome.runtime.getPlatformInfo(() => {});
};

chrome.alarms.create('keep-alive', { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    keepAlive();
  }
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('[HLTB] Service worker suspending...');
  // Integrated service handles its own queue management
});