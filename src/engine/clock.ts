import type { TickRate } from './types';

export class TickClock {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastMs = 0;

  constructor(
    private rate: TickRate,
    private readonly onTick: (count: number) => void,
  ) {}

  start() {
    this.stop();
    const interval = 1000 / this.rate;
    this.lastMs = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      const elapsed = now - this.lastMs;
      const ticks = Math.max(1, Math.floor(elapsed / interval));
      this.lastMs += ticks * interval;
      this.onTick(ticks);
    }, interval);
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setRate(rate: TickRate) {
    this.rate = rate;
    if (this.timer !== null) this.start();
  }
}
