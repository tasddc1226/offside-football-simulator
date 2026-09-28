import { test, expect, type Page } from '@playwright/test';
import { startCareer } from './helpers.js';

// 배경음악: 기본은 꺼짐. 화면 위쪽 스위치(설정의 '배경음악'과 같은 값)로 켜면 루프 음원 하나를 되풀이한다.
// 게임 화면(모든 탭)과 기록실을 뺀 하단 메뉴 화면 사이를 오가도 처음부터 다시 틀지 않고 이어서 튼다.
// 기록실로 가면 멈췄다가(컨텍스트 suspend) 돌아오면 멈춘 자리에서 이어 간다. 켠 상태는 이 기기에 남는다(ft_bgm).
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ft_sfx', 'false'); // 클릭 효과음의 AudioContext는 만들지 않는다.
    const w = window as unknown as { __ctx: AudioContext[]; __src: number };
    w.__ctx = [];
    w.__src = 0;
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(o?: AudioContextOptions) {
        super(o);
        w.__ctx.push(this);
      }
      override createBufferSource() {
        w.__src++;
        return super.createBufferSource();
      }
    };
  });
}
const audio = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __ctx: AudioContext[]; __src: number };
    return { contexts: w.__ctx.length, sources: w.__src, state: w.__ctx[0]?.state ?? 'none' };
  });

test('배경음악: 게임 탭과 하단 메뉴를 오가도 이어서 틀고, 기록실에서는 멈춘다', async ({
  page,
}) => {
  await watchAudio(page);
  await startCareer(page);
  const toggle = page.locator('[data-act="bgm"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect((await audio(page)).contexts).toBe(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm'))).toBe('true');
  const playing = { contexts: 1, sources: 1, state: 'running' };
  await expect.poll(() => audio(page)).toEqual(playing);

  // 게임 탭을 옮겨도, 홈·소식·구단주·설정으로 가도 같은 재생이 이어진다(새 소스를 만들지 않는다).
  await page.locator('[data-tab="player"]').click();
  await page.locator('[data-act="home"]').click();
  const nav = page.getByRole('navigation', { name: '메인 메뉴' });
  for (const menu of ['소식', '구단주', '설정']) {
    await nav.getByRole('button', { name: menu }).click();
    await expect(page.locator('[data-act="bgm"]')).toHaveAttribute('aria-checked', 'true');
    expect(await audio(page)).toEqual(playing);
  }

  // 기록실에서는 스위치가 없고 소리를 줄인 뒤 멈춘다.
  await nav.getByRole('button', { name: '기록실' }).click();
  await expect(page.locator('[data-act="bgm"]')).toHaveCount(0);
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');
  await nav.getByRole('button', { name: '홈' }).click();
  await expect.poll(() => audio(page)).toEqual(playing);

  // 설정의 스위치도 같은 값이다.
  await nav.getByRole('button', { name: '설정' }).click();
  const setting = page.locator('[data-setting="bgm"]');
  await expect(setting).toHaveAttribute('aria-checked', 'true');
  await setting.click();
  await expect(page.locator('[data-act="bgm"]')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm'))).toBe('false');
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');
});
