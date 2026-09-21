import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(String(key)) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(String(key));
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
  };
}

function browserStorage(name: 'localStorage' | 'sessionStorage'): Storage {
  try {
    const candidate = window[name];
    if (
      typeof candidate?.getItem === 'function' &&
      typeof candidate?.setItem === 'function' &&
      typeof candidate?.removeItem === 'function' &&
      typeof candidate?.clear === 'function'
    ) {
      return candidate;
    }
  } catch {
    // Opaque origins can reject storage access; the test-local fallback below
    // keeps browser-facing tests deterministic in that environment.
  }
  return createMemoryStorage();
}

// Node's `--localstorage-file` option can expose a separate global
// localStorage implementation. Browser-facing tests must use jsdom's storage,
// otherwise an injected Node global may not implement the Storage API. Validate
// jsdom's candidate too because Node 25 can replace the window proxy's storage
// with a partial implementation when the option has no usable file path.
if (typeof window !== 'undefined') {
  vi.stubGlobal('localStorage', browserStorage('localStorage'));
  vi.stubGlobal('sessionStorage', browserStorage('sessionStorage'));
}

afterEach(() => {
  cleanup();
});

// Radix radio bubble inputs measure their host; jsdom does not implement layout observers.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
