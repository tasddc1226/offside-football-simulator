import { createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { routeTree } from './routeTree.gen.js';
import { SCREEN_ROUTES } from './routes.js';

describe('SCREEN_ROUTES', () => {
  it('모든 경로가 라우트 트리에 있다', () => {
    const router = createRouter({ routeTree });
    const knownPaths = Object.keys(router.routesByPath);

    for (const path of Object.values(SCREEN_ROUTES)) {
      expect(knownPaths).toContain(path);
    }
  });
});
