import type { StringKV } from '../types.js';

/** 테스트·toss 스텁용 인메모리 `StringKV`. M-001에서 앱인토스 네이티브 `Storage`로 교체된다. */
export class MemoryStringKV implements StringKV {
  #map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.#map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.#map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.#map.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.#map.keys());
  }
}
