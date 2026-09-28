import { test, expect, type Page } from '@playwright/test';
import { startCareer } from './helpers.js';

// 배경음악: 기본은 꺼짐. 화면 위쪽 스위치(설정의 '배경음악'과 같은 값)로 켜면 곡을 되풀이한다.
// 게임 화면(모든 탭)과 홈·소식·구단주·설정은 main 곡(버퍼 루프), 기록실·선수 상세는 records 곡(<audio>)이다.
// 같은 곡의 화면끼리 오가면 처음부터 다시 틀지 않고 이어서 튼다. 곡이 바뀌면 이전 곡을 멈추고(멈춘 자리를 기억)
// 다른 곡을 튼다. 켠 상태는 이 기기에 남는다(ft_bgm).
async function watchAudio(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ft_sfx', 'false'); // 클릭 효과음의 AudioContext는 만들지 않는다.
    const w = window as unknown as {
      __ctx: AudioContext[];
      __src: number;
      __stopped: number;
      __gain: GainNode[];
      __media: HTMLMediaElement[];
    };
    w.__ctx = [];
    w.__src = 0;
    w.__stopped = 0;
    w.__gain = [];
    w.__media = [];
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(o?: AudioContextOptions) {
        super(o);
        w.__ctx.push(this);
      }
      override createGain() {
        const g = super.createGain();
        w.__gain.push(g);
        return g;
      }
      override createBufferSource() {
        w.__src++;
        const node = super.createBufferSource();
        const stop = node.stop.bind(node);
        node.stop = (when?: number) => {
          w.__stopped++;
          stop(when);
        };
        return node;
      }
      override createMediaElementSource(el: HTMLMediaElement) {
        w.__media.push(el);
        return super.createMediaElementSource(el);
      }
    };
  });
}
const audio = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      __ctx: AudioContext[];
      __src: number;
      __stopped: number;
      __media: HTMLMediaElement[];
    };
    return {
      contexts: w.__ctx.length,
      /** 지금 도는 main 곡 버퍼 소스 수. */
      sources: w.__src - w.__stopped,
      state: w.__ctx[0]?.state ?? 'none',
      /** records 곡: 아직 안 만들었으면 none. */
      records: w.__media[0] ? (w.__media[0].paused ? 'paused' : 'playing') : 'none',
    };
  });

test('배경음악: 게임 탭과 하단 메뉴를 오가도 이어서 틀고, 기록실에서는 다른 곡을 튼다', async ({
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
  const playing = { contexts: 1, sources: 1, state: 'running', records: 'none' };
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

  // 기록실에서는 records 곡으로 바뀐다(스위치도 있다). main 곡은 소리를 줄인 뒤 멈춘다.
  await nav.getByRole('button', { name: '기록실' }).click();
  await expect(page.locator('[data-act="bgm"]')).toHaveAttribute('aria-checked', 'true');
  await expect
    .poll(() => audio(page))
    .toEqual({ contexts: 1, sources: 0, state: 'running', records: 'playing' });
  // 홈으로 돌아오면 main 곡을 멈춘 자리에서 다시 틀고 records 곡은 멈춘다.
  await nav.getByRole('button', { name: '홈' }).click();
  await expect.poll(() => audio(page)).toEqual({ ...playing, records: 'paused' });

  // 설정의 스위치도 같은 값이다.
  await nav.getByRole('button', { name: '설정' }).click();
  const setting = page.locator('[data-setting="bgm"]');
  await expect(setting).toHaveAttribute('aria-checked', 'true');
  // 음량 슬라이더는 틀고 있는 음악에 바로 반영된다(기본 70% → 게인 0.35, 40% → 0.2).
  const gain = () =>
    page.evaluate(() => (window as unknown as { __gain: GainNode[] }).__gain[0]!.gain.value);
  await expect(page.locator('[data-setting="bgm-volume"]')).toHaveValue('70');
  await expect.poll(gain).toBeCloseTo(0.35, 2);
  await page.locator('[data-setting="bgm-volume"]').fill('40');
  await expect(page.locator('.settings-volume output')).toHaveText('40%');
  await expect.poll(gain).toBeCloseTo(0.2, 2);
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm_volume'))).toBe('40');
  await setting.click();
  await expect(page.locator('[data-act="bgm"]')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('ft_bgm'))).toBe('false');
  await expect.poll(async () => (await audio(page)).state).toBe('suspended');
});
