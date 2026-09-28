import { test, expect } from '@playwright/test';
import { startCareer } from './helpers.js';

// 배경음악: 기본은 꺼짐. 게임 화면 위쪽 스위치(설정의 '배경음악'과 같은 값)로 켜면 Web Audio로 루프를 합성하고,
// 게임 화면을 떠나면 멈춘다. 켠 상태는 이 기기에 남는다(ft_bgm).
test('배경음악: 게임 화면 스위치로 켜고, 화면을 떠나면 멈추고, 설정과 같은 값이다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('ft_sfx', 'false'); // 클릭 효과음 오실레이터는 세지 않는다.
    const w = window as unknown as { __osc: number };
    w.__osc = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      w.__osc++;
      return create.call(this);
    };
  });
  const voices = () => page.evaluate(() => (window as unknown as { __osc: number }).__osc);
  await startCareer(page);
  const toggle = page.locator('[data-act="bgm"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.waitForTimeout(500);
  expect(await voices()).toBe(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(voices).toBeGreaterThan(10);
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm'))).toBe('true');

  // 게임 화면을 떠나면 새 음을 잡지 않는다(0.5초 페이드 뒤 멈춤).
  await page.locator('[data-act="home"]').click();
  await page.waitForTimeout(800);
  const paused = await voices();
  await page.waitForTimeout(800);
  expect(await voices()).toBe(paused);

  await page.locator('[data-act="settings"]').click();
  const setting = page.locator('[data-setting="bgm"]');
  await expect(setting).toHaveAttribute('aria-checked', 'true');
  await setting.click();
  await expect(setting).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm'))).toBe('false');
});
