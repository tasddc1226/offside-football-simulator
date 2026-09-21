import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Node's `--localstorage-file` option can expose a separate global
// localStorage implementation. Browser-facing tests must use jsdom's storage,
// otherwise an injected Node global may not implement the Storage API and can
// leak state across test environments.
if (typeof window !== 'undefined') {
  try {
    vi.stubGlobal('localStorage', window.localStorage);
    vi.stubGlobal('sessionStorage', window.sessionStorage);
  } catch {
    // Accessing storage can throw when a test intentionally uses an opaque
    // origin; leave the environment's default globals intact in that case.
  }
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
