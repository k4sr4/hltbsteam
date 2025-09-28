class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private windowMs: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async wait(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    const waitTime = this.windowMs - (Date.now() - this.lastRefill);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    this.refill();
    this.tokens--;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.windowMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}

export class QueueService {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter(10, 60000);
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await this.rateLimiter.wait();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.processing = false;
  }

  async flush() {
    return Promise.all(this.queue.map(task => task()));
  }
}