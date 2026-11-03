/**
 * 有容量上限的 LRU 缓存。Map 的插入顺序即访问顺序。
 * @module managers/CacheManager
 */

export class CacheManager<K, V> {
  private readonly maxSize: number;
  private readonly cache = new Map<K, V>();
  private readonly onEvict?: (value: V, key: K) => void;

  constructor(maxSize = 10, onEvict?: (value: V, key: K) => void) {
    this.maxSize = Math.max(1, maxSize);
    this.onEvict = onEvict;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key) as V;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    this.trim();
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    if (!this.cache.has(key)) return false;
    const value = this.cache.get(key) as V;
    this.cache.delete(key);
    this.onEvict?.(value, key);
    return true;
  }

  clear(): void {
    if (this.onEvict) {
      for (const [key, value] of this.cache) {
        this.onEvict(value, key);
      }
    }
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private trim(): void {
    while (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value as K;
      const value = this.cache.get(oldest) as V;
      this.cache.delete(oldest);
      this.onEvict?.(value, oldest);
    }
  }
}
