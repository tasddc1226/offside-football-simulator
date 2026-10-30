import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** Fixed saved career, without candidate-generation requests or random preseason events. */
export async function resumeFixture(page: Page, patch: Record<string, unknown> = {}) {
  const save = {
    ...JSON.parse(
      readFileSync(
        new URL('../../../../packages/game/src/__fixtures__/save-fw26.json', import.meta.url),
        'utf8',
      ),
    ),
    ...patch,
  };
  await page.addInitScript((save) => {
    // Preserve subsequent changes when a scenario reloads to check save recovery.
    if (!localStorage.getItem('ft_save')) localStorage.setItem('ft_save', JSON.stringify(save));
  }, save);
  await page.goto('/');
  await page.locator('[data-act="continue"]').click();
}
