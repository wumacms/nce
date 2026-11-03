/**
 * 下一课歌词 / 音频预加载
 * @module services/prefetch
 */

import { CacheManager } from '../managers/CacheManager';
import type { Unit } from '../types';

function disposeAudio(audio: HTMLAudioElement): void {
  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch {
    // ignore
  }
}

export class PrefetchService {
  private readonly lrcCache: CacheManager<string, string>;
  private readonly audioCache: CacheManager<string, HTMLAudioElement>;
  private readonly inFlight = new Map<string, Promise<void>>();
  private epoch = 0; // clear() 时递增，用于丢弃过期回写（防切书后脏缓存）

  constructor(options: { maxLrc?: number; maxAudio?: number } = {}) {
    this.lrcCache = new CacheManager(options.maxLrc ?? 3);
    this.audioCache = new CacheManager(options.maxAudio ?? 3, disposeAudio);
  }

  async loadLrc(url: string, signal?: AbortSignal): Promise<string> {
    const cached = this.lrcCache.get(url);
    if (cached !== undefined) return cached;

    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    this.lrcCache.set(url, text);
    return text;
  }

  prefetch(unit: Unit | null | undefined): void {
    if (!unit) return;
    const epoch = this.epoch;

    if (unit.lrc && !this.lrcCache.has(unit.lrc) && !this.inFlight.has(unit.lrc)) {
      const task = fetch(unit.lrc)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((text) => {
          // 期间若发生 clear()（如切书），丢弃过期结果
          if (epoch === this.epoch) this.lrcCache.set(unit.lrc as string, text);
        })
        .catch(() => {})
        .finally(() => {
          this.inFlight.delete(unit.lrc as string);
        });
      this.inFlight.set(unit.lrc, task);
    }

    if (unit.audio && !this.audioCache.has(unit.audio)) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = unit.audio;
      this.audioCache.set(unit.audio, audio);
    }
  }

  clear(): void {
    this.epoch += 1;
    this.inFlight.clear();
    this.lrcCache.clear();
    this.audioCache.clear();
  }
}
