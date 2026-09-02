// TEST-E2E-009(접근성 기준): 허브·법적 문서 화면에 axe serious·critical 위반이 없다.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SCREENS = ['/', '/legal/privacy', '/legal/terms'];

for (const path of SCREENS) {
  test(`${path} 화면에 axe serious·critical 위반이 없다`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    console.log(
      `[a11y] ${path}: 전체 위반 ${results.violations.length}건, serious/critical ${seriousOrCritical.length}건`,
    );
    if (results.violations.length > 0) {
      console.log(
        JSON.stringify(
          results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length })),
          null,
          2,
        ),
      );
    }

    expect(seriousOrCritical).toEqual([]);
  });
}
