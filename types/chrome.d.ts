/**
 * Chrome Extension API type definitions supplement
 * Adds additional types not covered by @types/chrome
 */

declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      url?: string;
      tlsChannelId?: string;
      origin?: string;
      documentId?: string;
      documentLifecycle?: string;
    }

    interface Port {
      name: string;
      disconnect: () => void;
      onDisconnect: chrome.events.Event<() => void>;
      onMessage: chrome.events.Event<(message: any) => void>;
      postMessage: (message: any) => void;
      sender?: MessageSender;
    }

    interface ConnectInfo {
      name?: string;
      includeTlsChannelId?: boolean;
    }

    function connect(connectInfo?: ConnectInfo): Port;
    function connect(extensionId: string, connectInfo?: ConnectInfo): Port;
  }

  namespace storage {
    interface StorageChange {
      oldValue?: any;
      newValue?: any;
    }

    interface StorageArea {
      get(): Promise<{ [key: string]: any }>;
      get(keys: string | string[] | { [key: string]: any } | null): Promise<{ [key: string]: any }>;
      getBytesInUse(): Promise<number>;
      getBytesInUse(keys: string | string[]): Promise<number>;
      set(items: { [key: string]: any }): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
      onChanged: chrome.events.Event<(changes: { [key: string]: StorageChange }) => void>;
    }
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      openerTabId?: number;
      selected?: boolean;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      audible?: boolean;
      discarded: boolean;
      autoDiscardable: boolean;
      mutedInfo?: MutedInfo;
      url?: string;
      pendingUrl?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      incognito: boolean;
      width?: number;
      height?: number;
      sessionId?: string;
      groupId: number;
    }

    interface MutedInfo {
      muted: boolean;
      reason?: string;
      extensionId?: string;
    }
  }

  namespace scripting {
    interface InjectionTarget {
      tabId: number;
      frameIds?: number[];
      documentIds?: string[];
      allFrames?: boolean;
    }

    interface ScriptInjection {
      target: InjectionTarget;
      files?: string[];
      func?: () => void;
      args?: any[];
      world?: 'ISOLATED' | 'MAIN';
      injectImmediately?: boolean;
    }

    interface CSSInjection {
      target: InjectionTarget;
      files?: string[];
      css?: string;
      origin?: 'USER' | 'AUTHOR';
    }

    function executeScript(injection: ScriptInjection): Promise<any[]>;
    function insertCSS(injection: CSSInjection): Promise<void>;
    function removeCSS(injection: CSSInjection): Promise<void>;
  }

  namespace permissions {
    interface Permissions {
      permissions?: string[];
      origins?: string[];
    }

    function contains(permissions: Permissions): Promise<boolean>;
    function request(permissions: Permissions): Promise<boolean>;
    function remove(permissions: Permissions): Promise<boolean>;
    function getAll(): Promise<Permissions>;

    const onAdded: chrome.events.Event<(permissions: Permissions) => void>;
    const onRemoved: chrome.events.Event<(permissions: Permissions) => void>;
  }

  namespace alarms {
    interface Alarm {
      name: string;
      scheduledTime: number;
      periodInMinutes?: number;
    }

    interface AlarmCreateInfo {
      when?: number;
      delayInMinutes?: number;
      periodInMinutes?: number;
    }

    function create(name: string, alarmInfo: AlarmCreateInfo): void;
    function create(alarmInfo: AlarmCreateInfo): void;
    function get(name?: string): Promise<Alarm | undefined>;
    function getAll(): Promise<Alarm[]>;
    function clear(name?: string): Promise<boolean>;
    function clearAll(): Promise<boolean>;

    const onAlarm: chrome.events.Event<(alarm: Alarm) => void>;
  }
}

// Global declarations for extension environment
declare global {
  // Extension API availability check
  const chrome: typeof chrome | undefined;

  // Service Worker environment
  interface ServiceWorkerGlobalScope {
    chrome: typeof chrome;
  }

  // Content Script environment
  interface Window {
    chrome?: typeof chrome;
  }

  // Common extension message types
  interface ExtensionMessage {
    action: string;
    [key: string]: any;
  }

  interface ExtensionResponse {
    success: boolean;
    data?: any;
    error?: string;
    [key: string]: any;
  }
}

export {};