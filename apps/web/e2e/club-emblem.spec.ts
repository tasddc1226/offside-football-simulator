import { test, expect, type Page } from '@playwright/test';
import { CLUBS } from '@offside/game/data';
import { storedBig } from './helpers.js';

const storedClubs = (page: Page) => storedBig(page, 'ft_clubs');

// T-11-607 구단 엠블럼 투명 배경 · 에디트 파일 오류 안내.
async function open(page: Page) {
  await page.goto('/');
  await page.locator('[data-act="settings"]').click();
  await page.locator('[data-settings-open="clubs"]').click();
  await page.locator('#club-league').selectOption('pl');
}

/** 사파리처럼 canvas가 WebP를 못 만들어 PNG로 떨어지는 브라우저. */
const noWebpEncoder = (page: Page) =>
  page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: number) {
      return original.call(this, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });

/** 200×200 그림(가운데만 빨강). opaque면 나머지를 흰색으로 채운다. */
const picture = async (page: Page, opaque: boolean) =>
  Buffer.from(
    await page.evaluate((fill) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 200;
      const ctx = canvas.getContext('2d')!;
      if (fill) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 200, 200);
      }
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(60, 60, 80, 80);
      return canvas.toDataURL('image/png').split(',')[1]!;
    }, opaque),
    'base64',
  );

async function uploadTo(page: Page, buffer: Buffer) {
  await page.locator('[data-club="pl-0"] [data-act="logo"]').click();
  await page
    .locator('[data-club="pl-0"] input[type="file"]')
    .setInputFiles({ name: 'emblem.png', mimeType: 'image/png', buffer });
}

/** 저장된 엠블럼의 형식과 왼쪽 위 모서리 알파값. */
async function saved(page: Page) {
  await expect
    .poll(async () => (await storedClubs(page))?.includes('data:image') ?? false)
    .toBe(true);
  const raw = (await storedClubs(page))!;
  return page.evaluate(async (raw) => {
    const stored = JSON.parse(raw) as {
      clubs: Record<string, { logo: { img: string } }>;
    };
    const src = stored.clubs['pl-0']!.logo.img;
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0, 64, 64);
    return { type: src.slice(0, src.indexOf(';')), alpha: ctx.getImageData(1, 1, 1, 1).data[3] };
  }, raw);
}

test('WebP를 못 만드는 브라우저에서도 투명 배경을 지킨다', async ({ page }) => {
  await noWebpEncoder(page);
  await open(page);
  await uploadTo(page, await picture(page, false));
  expect(await saved(page)).toEqual({ type: 'data:image/png', alpha: 0 });
});

test('WebP를 못 만드는 브라우저에서 불투명한 이미지는 JPEG로 저장한다', async ({ page }) => {
  await noWebpEncoder(page);
  await open(page);
  await uploadTo(page, await picture(page, true));
  expect(await saved(page)).toEqual({ type: 'data:image/jpeg', alpha: 255 });
});

test('WebP를 만드는 브라우저는 그대로 WebP로 저장하고 투명 배경을 지킨다', async ({ page }) => {
  await open(page);
  await uploadTo(page, await picture(page, false));
  expect(await saved(page)).toEqual({ type: 'data:image/webp', alpha: 0 });
});

const importFile = (page: Page, text: string) =>
  page.locator('#settings-clubs input[type="file"][accept*="json"]').setInputFiles({
    name: 'offside-clubs.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });

// T-11-697 예전엔 localStorage(약 5MB)가 차면 '저장 공간이 부족해 저장하지 못했어요'로 막혔다. 이제 엠블럼은 IndexedDB에 둔다.
test('localStorage가 거의 차 있어도 엠블럼 에디트 파일을 불러오고 새로고침 뒤에도 남는다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('filler')) localStorage.setItem('filler', 'x'.repeat(1_000_000));
  });
  await open(page);
  const clubs = Object.fromEntries(
    CLUBS.map((c) => [
      c.id,
      {
        logo: {
          text: 'A',
          bg: '#000000',
          fg: '#ffffff',
          img: `data:image/webp;base64,${'A'.repeat(15_900)}`,
        },
      },
    ]),
  );
  await importFile(page, JSON.stringify({ v: 1, clubs }));
  await expect(page.getByText(`구단 ${CLUBS.length}개 설정을 불러왔어요`)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ft_clubs') == null)).toBe(true);
  expect((await storedClubs(page))?.length ?? 0).toBeGreaterThan(CLUBS.length * 15_900);
  await open(page);
  await expect(page.locator('[data-club="pl-0"] img[src^="data:image"]').first()).toBeVisible();
});

test('JSON이 아닌 파일은 형식 오류로 안내한다', async ({ page }) => {
  await open(page);
  await importFile(page, 'not json');
  await expect(page.getByText('에디트 파일 형식이 올바르지 않아요')).toBeVisible();
});
