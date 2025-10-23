/**
 * Optimization Utilities for HLTB Steam Extension
 *
 * Performance-optimized utility functions:
 * - throttle: Limit function execution rate
 * - RAFQueue: Batch DOM operations for 60fps
 * - LazyImageLoader: Lazy load images with IntersectionObserver
 */

/**
 * Throttle function execution to limit call rate
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @param options - Throttle options
 * @returns Throttled function
 *
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
  } = {}
): (...args: Parameters<T>) => void {
  const { leading = true, trailing = true } = options;

  let lastRan: number | null = null;
  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>): void {
    const now = performance.now();

    // First call or enough time has passed
    if (lastRan === null && leading) {
      fn(...args);
      lastRan = now;
      return;
    }

    // Store arguments for potential trailing call
    lastArgs = args;

    // Clear any pending trailing call
    if (lastFunc !== null) {
      clearTimeout(lastFunc);
      lastFunc = null;
    }

    // Check if we should execute immediately
    if (lastRan !== null && now - lastRan >= limit) {
      fn(...args);
      lastRan = now;
      lastArgs = null;
    } else if (trailing) {
      // Schedule trailing call
      const timeUntilNext = lastRan !== null ? limit - (now - lastRan) : limit;
      lastFunc = setTimeout(() => {
        if (lastArgs !== null) {
          fn(...lastArgs);
          lastRan = performance.now();
          lastArgs = null;
        }
        lastFunc = null;
      }, timeUntilNext);
    }
  };
}

/**
 * Request Animation Frame Queue for batched DOM operations
 *
 * Batches multiple DOM operations into a single RAF call for 60fps
 *
 * @example
 * const rafQueue = new RAFQueue();
 * rafQueue.add(() => element.style.top = '10px');
 * rafQueue.add(() => element.style.left = '20px');
 * // Both operations execute in single frame
 */
export class RAFQueue {
  private queue: Array<() => void> = [];
  private rafId: number | null = null;
  private isProcessing: boolean = false;

  /**
   * Add operation to the queue
   */
  add(operation: () => void): void {
    this.queue.push(operation);

    // Schedule processing if not already scheduled
    if (this.rafId === null && !this.isProcessing) {
      this.rafId = requestAnimationFrame(() => this.process());
    }
  }

  /**
   * Process all queued operations
   */
  private process(): void {
    this.rafId = null;
    this.isProcessing = true;

    const operations = [...this.queue];
    this.queue = [];

    // Execute all operations
    for (const operation of operations) {
      try {
        operation();
      } catch (error) {
        console.error('[RAFQueue] Operation failed:', error);
      }
    }

    this.isProcessing = false;

    // If more operations were added during processing, schedule another frame
    if (this.queue.length > 0 && this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.process());
    }
  }

  /**
   * Clear all pending operations
   */
  clear(): void {
    this.queue = [];

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Get number of pending operations
   */
  get pending(): number {
    return this.queue.length;
  }

  /**
   * Execute operations immediately without waiting for RAF
   */
  flush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.process();
  }
}

/**
 * Lazy Image Loader using IntersectionObserver
 *
 * Efficiently loads images when they enter viewport
 *
 * @example
 * const loader = new LazyImageLoader();
 * loader.observe(imageElement, 'https://example.com/image.jpg');
 */
export class LazyImageLoader {
  private observer: IntersectionObserver | null = null;
  private imageMap: WeakMap<Element, string> = new WeakMap();
  private loadedImages: WeakSet<Element> = new WeakSet();

  constructor(
    options: IntersectionObserverInit = {
      rootMargin: '50px', // Load 50px before entering viewport
      threshold: 0.01
    }
  ) {
    // Check if IntersectionObserver is supported
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        this.handleIntersection(entries);
      }, options);
    } else {
      console.warn('[LazyImageLoader] IntersectionObserver not supported');
    }
  }

  /**
   * Start observing an image element
   */
  observe(element: HTMLImageElement, src: string): void {
    if (!this.observer) {
      // Fallback: load immediately if IntersectionObserver not supported
      this.loadImage(element, src);
      return;
    }

    this.imageMap.set(element, src);
    this.observer.observe(element);
  }

  /**
   * Stop observing an image element
   */
  unobserve(element: HTMLImageElement): void {
    if (this.observer) {
      this.observer.unobserve(element);
    }
    this.imageMap.delete(element);
  }

  /**
   * Handle intersection events
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const element = entry.target as HTMLImageElement;
        const src = this.imageMap.get(element);

        if (src && !this.loadedImages.has(element)) {
          this.loadImage(element, src);
          this.loadedImages.add(element);

          // Stop observing once loaded
          if (this.observer) {
            this.observer.unobserve(element);
          }
        }
      }
    }
  }

  /**
   * Load an image
   */
  private loadImage(element: HTMLImageElement, src: string): void {
    // Create a new image to preload
    const img = new Image();

    img.onload = () => {
      element.src = src;
      element.classList.add('lazy-loaded');
      element.removeAttribute('data-lazy');
    };

    img.onerror = () => {
      console.error('[LazyImageLoader] Failed to load image:', src);
      element.classList.add('lazy-error');
    };

    img.src = src;
  }

  /**
   * Load all pending images immediately
   */
  loadAll(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    // Load all images in the map
    for (const [element, src] of Array.from(this.imageMap.entries() as any)) {
      if (!this.loadedImages.has(element)) {
        this.loadImage(element as HTMLImageElement, src);
        this.loadedImages.add(element);
      }
    }

    this.imageMap = new WeakMap();
  }

  /**
   * Destroy the loader
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.imageMap = new WeakMap();
    this.loadedImages = new WeakSet();
  }
}

/**
 * Batch DOM reads and writes for better performance
 *
 * @example
 * const batch = new DOMBatcher();
 * batch.read(() => element.offsetWidth);
 * batch.write(() => element.style.width = '100px');
 * batch.flush();
 */
export class DOMBatcher {
  private readQueue: Array<() => any> = [];
  private writeQueue: Array<() => void> = [];
  private rafId: number | null = null;

  /**
   * Schedule a DOM read operation
   */
  read<T>(operation: () => T): Promise<T> {
    return new Promise((resolve) => {
      this.readQueue.push(() => {
        const result = operation();
        resolve(result);
        return result;
      });

      this.schedule();
    });
  }

  /**
   * Schedule a DOM write operation
   */
  write(operation: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.writeQueue.push(() => {
        operation();
        resolve();
      });

      this.schedule();
    });
  }

  /**
   * Schedule processing
   */
  private schedule(): void {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * Process all batched operations
   */
  flush(): void {
    this.rafId = null;

    // Process all reads first (avoid layout thrashing)
    const reads = [...this.readQueue];
    this.readQueue = [];

    for (const read of reads) {
      try {
        read();
      } catch (error) {
        console.error('[DOMBatcher] Read operation failed:', error);
      }
    }

    // Then process all writes
    const writes = [...this.writeQueue];
    this.writeQueue = [];

    for (const write of writes) {
      try {
        write();
      } catch (error) {
        console.error('[DOMBatcher] Write operation failed:', error);
      }
    }

    // If more operations were added during processing, schedule another flush
    if (this.readQueue.length > 0 || this.writeQueue.length > 0) {
      this.schedule();
    }
  }

  /**
   * Clear all pending operations
   */
  clear(): void {
    this.readQueue = [];
    this.writeQueue = [];

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

/**
 * Optimize expensive calculations with memoization and LRU cache
 *
 * @param fn - Function to memoize
 * @param maxSize - Maximum cache size (default: 100)
 * @param keyFn - Optional custom key function
 * @returns Memoized function with LRU cache
 *
 * @example
 * const normalizeTitle = memoizeWithLRU(
 *   (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, ''),
 *   100
 * );
 */
export function memoizeWithLRU<T extends (...args: any[]) => any>(
  fn: T,
  maxSize: number = 100,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, { value: ReturnType<T>; order: number }>();
  let order = 0;

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    // Check cache
    if (cache.has(key)) {
      const entry = cache.get(key)!;
      // Update access order
      entry.order = ++order;
      return entry.value;
    }

    // Execute function
    const result = fn(...args);

    // Add to cache
    cache.set(key, { value: result, order: ++order });

    // Evict oldest entry if cache is full
    if (cache.size > maxSize) {
      let oldestKey: string | null = null;
      let oldestOrder = Infinity;

      for (const [k, v] of cache.entries()) {
        if (v.order < oldestOrder) {
          oldestOrder = v.order;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    return result;
  }) as T;
}

/**
 * Create a pool of reusable objects to reduce GC pressure
 *
 * @example
 * const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 10);
 * const obj = pool.acquire();
 * obj.x = 10;
 * pool.release(obj);
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private reset?: (obj: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    initialSize: number = 10,
    maxSize: number = 100,
    reset?: (obj: T) => void
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.reset = reset;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    let obj: T;

    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('[ObjectPool] Attempting to release object not acquired from pool');
      return;
    }

    this.inUse.delete(obj);

    // Reset object if reset function provided
    if (this.reset) {
      this.reset(obj);
    }

    // Only return to pool if not at max size
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }

  /**
   * Release all objects back to the pool
   */
  releaseAll(): void {
    for (const obj of this.inUse) {
      if (this.reset) {
        this.reset(obj);
      }

      if (this.available.length < this.maxSize) {
        this.available.push(obj);
      }
    }

    this.inUse.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): { available: number; inUse: number; total: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size
    };
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.available = [];
    this.inUse.clear();
  }
}

/**
 * Efficient event delegation for dynamic content
 *
 * @example
 * const delegator = new EventDelegator(document.body);
 * delegator.on('click', '.button', (e, target) => console.log('Clicked!'));
 */
export class EventDelegator {
  private root: HTMLElement;
  private handlers: Map<
    string,
    Array<{
      selector: string;
      handler: (event: Event, target: Element) => void;
    }>
  > = new Map();

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /**
   * Add delegated event listener
   */
  on(
    eventType: string,
    selector: string,
    handler: (event: Event, target: Element) => void
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);

      // Add single root listener for this event type
      this.root.addEventListener(eventType, (event) => {
        this.handleEvent(eventType, event);
      });
    }

    this.handlers.get(eventType)!.push({ selector, handler });
  }

  /**
   * Handle delegated event
   */
  private handleEvent(eventType: string, event: Event): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    const target = event.target as Element;

    for (const { selector, handler } of handlers) {
      const matchingElement = target.closest(selector);
      if (matchingElement && this.root.contains(matchingElement)) {
        handler(event, matchingElement);
      }
    }
  }

  /**
   * Remove all handlers for an event type
   */
  off(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}
