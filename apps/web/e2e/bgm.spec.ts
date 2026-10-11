import { test, expect, type Page } from '@playwright/test';
import { startCareer } from './helpers.js';

// 배경음악: 기본은 꺼짐. 화면 위쪽 스위치(설정의 '배경음악'과 같은 값)로 켜면 곡을 <audio>로 되풀이한다.
// 게임 화면(모든 탭)과 홈·소식·구단주·설정은 main 곡, 기록실·선수 상세는 records 곡이다.
// 같은 곡의 화면끼리 오가면 처음부터 다시 틀지 않고 이어서 튼다. 곡이 바뀌면 이전 곡은 소리를 줄인 뒤 멈추고(멈춘
// 자리에서 다시 튼다) 다른 곡을 튼다. 켠 상태는 이 기기에 남는다(ft_bgm).
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ft_sfx', 'false');
    const w = window as unknown as { __media: HTMLMediaElement[] };
    w.__media = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!w.__media.includes(this)) w.__media.push(this);
      return play.call(this);
    };
  });
}
/** 곡마다 만든 <audio> 수와 상태. 아직 안 틀었으면 none. */
const audio = (page: Page) =>
  page.evaluate(() => {
    const els = (window as unknown as { __media: HTMLMediaElement[] }).__media;
    const of = (name: string) => {
      const mine = els.filter((e) => e.src.includes(name));
      if (mine.length === 0) return 'none';
      return mine.map((e) => (e.paused ? 'paused' : 'playing')).join(',');
    };
    return { main: of('bgm-loop'), records: of('bgm-records') };
  });
const mainVolume = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __media: HTMLMediaElement[] }).__media.find((e) =>
        e.src.includes('bgm-loop'),
      )!.volume,
  );

test('배경음악: 게임 탭과 하단 메뉴를 오가도 이어서 틀고, 기록실에서는 다른 곡을 튼다', async ({
  page,
}) => {
  await watchAudio(page);
  await startCareer(page);
  const toggle = page.locator('[data-act="bgm"]');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(await audio(page)).toEqual({ main: 'none', records: 'none' });

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm'))).toBe('true');
  const playing = { main: 'playing', records: 'none' };
  await expect.poll(() => audio(page)).toEqual(playing);

  // 게임 탭을 옮겨도, 홈·소식·구단주·설정으로 가도 같은 <audio>가 이어서 돈다.
  await page.locator('[data-tab="player"]').click();
  await page.locator('[data-act="home"]').click();
  const nav = page.getByRole('navigation', { name: '메인 메뉴' });
  for (const menu of ['소식', '내 구단', '설정']) {
    await nav.getByRole('button', { name: menu }).click();
    await expect(page.locator('[data-act="bgm"]')).toHaveAttribute('aria-checked', 'true');
    expect(await audio(page)).toEqual(playing);
  }

  // 기록실에서는 records 곡으로 바뀐다(스위치도 있다). main 곡은 소리를 줄인 뒤 멈춘다.
  await nav.getByRole('button', { name: '기록실' }).click();
  await expect(page.locator('[data-act="bgm"]')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => audio(page)).toEqual({ main: 'paused', records: 'playing' });
  // 홈으로 돌아오면 같은 main <audio>를 멈춘 자리에서 다시 틀고 records 곡은 멈춘다.
  await nav.getByRole('button', { name: '홈' }).click();
  await expect.poll(() => audio(page)).toEqual({ main: 'playing', records: 'paused' });

  // 설정의 스위치도 같은 값이다.
  await nav.getByRole('button', { name: '설정' }).click();
  const setting = page.locator('[data-setting="bgm"]');
  await expect(setting).toHaveAttribute('aria-checked', 'true');
  // 음량 슬라이더는 틀고 있는 음악에 바로 반영된다(기본 70% → 0.35, 40% → 0.2).
  await expect(page.locator('[data-setting="bgm-volume"]')).toHaveValue('70');
  await expect.poll(() => mainVolume(page)).toBeCloseTo(0.35, 2);
  await page.locator('[data-setting="bgm-volume"]').fill('40');
  await expect(page.locator('.settings-volume output')).toHaveText('40%');
  await expect.poll(() => mainVolume(page)).toBeCloseTo(0.2, 2);
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm_volume'))).toBe('40');
  await setting.click();
  await expect(page.locator('[data-act="bgm"]')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm'))).toBe('false');
  await expect.poll(() => audio(page)).toEqual({ main: 'paused', records: 'paused' });
});

test('배경음악: 음량을 페이지에서 못 바꾸는 기기(아이폰)는 슬라이더 대신 안내를 보이고, 곡은 바로 바꾼다', async ({
  page,
}) => {
  await watchAudio(page);
  // 아이폰처럼 <audio>.volume 설정을 무시한다(늘 1).
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
      get: () => 1,
      set: () => {},
      configurable: true,
    });
  });
  await startCareer(page);
  await page.locator('[data-act="bgm"]').click();
  await expect.poll(() => audio(page)).toEqual({ main: 'playing', records: 'none' });
  await page.locator('[data-act="home"]').click();
  const nav = page.getByRole('navigation', { name: '메인 메뉴' });
  await nav.getByRole('button', { name: '기록실' }).click();
  expect(await audio(page)).toEqual({ main: 'paused', records: 'playing' });
  await nav.getByRole('button', { name: '설정' }).click();
  await expect(page.locator('[data-setting="bgm-volume"]')).toHaveCount(0);
  await expect(page.locator('[data-setting="bgm-volume-note"]')).toHaveText(
    '이 기기에서는 배경음악 음량을 기기 음량 버튼으로 조절해요.',
  );
});
