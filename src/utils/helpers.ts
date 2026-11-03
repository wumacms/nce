/**
 * 通用工具
 * @module utils/helpers
 */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function throttle<T extends (...args: never[]) => void>(func: T, wait = 300): T {
  let lastCall = 0;
  return function throttled(this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      func.apply(this, args);
    }
  } as T;
}

export function debounce<T extends (...args: never[]) => void>(func: T, wait = 300): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  function debounced(this: unknown, ...args: Parameters<T>): void {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      func.apply(this, args);
    }, wait);
  }
  debounced.cancel = (): void => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = undefined;
  };
  return debounced as T & { cancel: () => void };
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
