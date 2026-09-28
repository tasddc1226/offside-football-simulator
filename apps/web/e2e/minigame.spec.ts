import { test, expect, type Page } from '@playwright/test';
import { resumeWithSave } from './helpers.js';

// T-10-089 원터치 미니게임: 경기 장면이 있는 선택지는 확률 판정 대신 타이밍 게이지로 가린다.
// 바늘이 초록 구간에 있을 때 탭하면 성공, 밖이면 실패. 판정·기록은 탭하는 순간 끝난다(선택 로그에 정확도 mg).

/** 바늘이 구간 안(inside) 또는 구간에서 멀리(!inside) 있을 때 장면을 누른다(프레임마다 확인). */
async function tapWhen(page: Page, inside: boolean) {
  await page.evaluate((inside) => {
    const stage = document.querySelector<HTMLElement>('#sheet [data-mg-tap]')!;
    const zone = stage.querySelector<HTMLElement>('.mg-zone')!;
    const needle = stage.querySelector<HTMLElement>('.needle')!;
    return new Promise<void>((done) => {
      const frame = () => {
        const z = zone.getBoundingClientRect(),
          n = needle.getBoundingClientRect(),
          x = n.left + n.width / 2,
          mid = z.left + z.width / 2;
        const hit = inside ? Math.abs(x - mid) < z.width / 6 : Math.abs(x - mid) > z.width * 1.5;
        if (!hit) return void requestAnimationFrame(frame);
        stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        done();
      };
      requestAnimationFrame(frame);
    });
  }, inside);
}
const lastLog = (page: Page) =>
  page.evaluate(() => {
    const buf = JSON.parse(localStorage.getItem('ft_save')!).evBuf as {
      id: string;
      ok: boolean;
      mg?: number;
    }[];
    return buf.at(-1)!;
  });

for (const inside of [true, false]) {
  test(`미니게임: 바늘이 초록 구간 ${inside ? '안이면 성공' : '밖이면 실패'}하고 탭 정확도가 기록된다`, async ({
    page,
  }) => {
    await resumeWithSave(page, { pending: { type: 'event', id: 'penalty' } });
    const sheet = page.locator('#sheet');
    await expect(sheet).toContainText('결정적인 페널티킥');
    const choice = sheet.locator('[data-choice="0"]');
    await expect(choice).toContainText(/원터치 · (넓음|보통|좁음)/);
    await choice.click();

    await expect(sheet.locator('[data-mg-tap]')).toContainText('슛!');
    await tapWhen(page, inside);
    await expect(sheet.locator('.mg-caption')).toHaveText(inside ? '골!' : '크로스바!');
    await expect(sheet.locator('.result-big')).toHaveText(inside ? '성공' : '실패');
    await expect(sheet.locator('[data-mg-timing]')).toHaveText(
      inside ? /완벽한 타이밍!|타이밍 성공/ : '타이밍을 놓쳤어요',
    );
    const log = await lastLog(page);
    expect(log).toMatchObject({ id: 'penalty', ok: inside });
    expect(log.mg! <= 100).toBe(inside);
  });
}

test('미니게임: 3초 안에 누르지 않으면 시간 초과로 실패한다', async ({ page }) => {
  await resumeWithSave(page, { pending: { type: 'event', id: 'penalty' } });
  const sheet = page.locator('#sheet');
  await sheet.locator('[data-choice="0"]').click();
  await expect(sheet.locator('.mg-timer b')).toHaveText('3');
  await expect(sheet.locator('.mg-caption')).toHaveText('시간 초과!', { timeout: 5000 });
  await expect(sheet.locator('.result-big')).toHaveText('실패');
  await expect(sheet.locator('[data-mg-timing]')).toContainText('시간 초과');
  expect(await lastLog(page)).toMatchObject({ id: 'penalty', ok: false, mg: 1000 });
});

test('감속 모션이면 미니게임 없이 표시된 확률로 판정한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeWithSave(page, { pending: { type: 'event', id: 'penalty' } });
  const sheet = page.locator('#sheet');
  await expect(sheet.locator('[data-choice="0"]')).toContainText(/\d+%/);
  await sheet.locator('[data-choice="0"]').click();
  await expect(sheet.locator('.result-big')).toHaveText(/성공|실패/);
  await expect(sheet.locator('[data-mg-timing]')).toHaveCount(0);
  expect((await lastLog(page)).mg).toBeUndefined();
});
