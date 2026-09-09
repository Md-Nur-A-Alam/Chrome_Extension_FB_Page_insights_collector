export interface ScrollOptions {
  stepSize?: number;
  minDelay?: number;
  maxDelay?: number;
  maxIdleAttempts?: number;
}

export class ScrollManager {
  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private consecutiveIdleCount: number = 0;
  private lastScrollY: number = -1;
  private lastDocHeight: number = -1;

  constructor(private options: ScrollOptions = {}) {
    this.options = {
      stepSize: options.stepSize || 600,
      minDelay: options.minDelay || 800,
      maxDelay: options.maxDelay || 1500,
      maxIdleAttempts: options.maxIdleAttempts || 5
    };
  }

  /**
   * Scroll down incrementally with human-like jitter
   */
  public async scrollDown(): Promise<{ reachedEnd: boolean }> {
    if (this.isCancelled) {
      return { reachedEnd: true };
    }

    while (this.isPaused) {
      await this.sleep(400);
      if (this.isCancelled) return { reachedEnd: true };
    }

    const currentY = window.scrollY || window.pageYOffset;

    // Jittered scroll distance
    const step = (this.options.stepSize || 600) + Math.floor((Math.random() - 0.5) * 100);
    window.scrollBy({ top: step, behavior: 'smooth' });

    // Paced human delay
    const delay = this.getRandomDelay();
    await this.sleep(delay);

    const newY = window.scrollY || window.pageYOffset;
    const newDocHeight = document.documentElement.scrollHeight;

    // Check if bottom reached or no progress made
    const scrolledToBottom = (window.innerHeight + newY) >= (newDocHeight - 100);
    const didNotMove = (Math.abs(newY - currentY) < 10 || (this.lastScrollY !== -1 && Math.abs(newY - this.lastScrollY) < 10)) &&
      (this.lastDocHeight === -1 || Math.abs(newDocHeight - this.lastDocHeight) < 10);

    if (scrolledToBottom || didNotMove) {
      this.consecutiveIdleCount++;
      if (this.consecutiveIdleCount >= (this.options.maxIdleAttempts || 5)) {
        return { reachedEnd: true };
      }
      // Small bump scroll up then down to trigger virtualization observer if stuck
      window.scrollBy({ top: -150, behavior: 'smooth' });
      await this.sleep(600);
      window.scrollBy({ top: 300, behavior: 'smooth' });
      await this.sleep(600);
    } else {
      this.consecutiveIdleCount = 0;
    }

    this.lastScrollY = newY;
    this.lastDocHeight = newDocHeight;

    return { reachedEnd: false };
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  public reset(): void {
    this.isPaused = false;
    this.isCancelled = false;
    this.consecutiveIdleCount = 0;
    this.lastScrollY = -1;
    this.lastDocHeight = -1;
  }

  private getRandomDelay(): number {
    const min = this.options.minDelay || 800;
    const max = this.options.maxDelay || 1500;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
