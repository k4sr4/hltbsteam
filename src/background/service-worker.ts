import { MessageHandler } from './message-handler';
import { hltbIntegratedService } from './services/hltb-integrated-service';
import { ErrorHandler } from '../shared';

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