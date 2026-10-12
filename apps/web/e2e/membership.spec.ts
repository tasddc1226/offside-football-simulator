import { test, expect } from '@playwright/test';
import { API, ok, fail } from './helpers.js';
for (const locale of ['ko-KR', 'en-US', 'ja-JP'])
  test.describe(locale, () => {
    test.use({ locale });
    test('web membership has app-only purchase guidance and saves cosmetics at 320px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.addInitScript(() => localStorage.setItem('ft_session', '1'));
      await page.route(`${API}/v1/**`, (r) => r.fulfill(fail(503, 'UNAVAILABLE', 'fixture')));
      await page.route(`${API}/v1/profile*`, (r) =>
        r.fulfill(
          ok({
            id: 'test',
            linked: { google: true },
            nickname: 'Owner',
            googleEmailMasked: 'a***@example.com',
            recoveryCodeIssuedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
        ),
      );
      const data = {
        membership: {
          active: true,
          status: 'active',
          store: 'apple',
          paidUntil: '2099-11-12T00:00:00.000Z',
          graceUntil: null,
          autoRenew: true,
          paidMonths: 3,
          badge: 'silver',
          appearance: { theme: 'classic', frame: 'none', supporterTitle: false },
          salesEnabled: false,
          grants: [],
        },
        account: 'test',
        stores: [],
        items: { reroll: 40, scout: 5, boost: 10 },
      };
      await page.route(`${API}/v1/membership*`, (r) => r.fulfill(ok(data)));
      let saved: unknown;
      await page.route(`${API}/v1/membership/appearance*`, (r) => {
        saved = r.request().postDataJSON();
        return r.fulfill(
          ok({
            ...data,
            membership: {
              ...data.membership,
              appearance: { ...data.membership.appearance, ...(saved as object) },
            },
          }),
        );
      });
      await page.goto('/');
      await page
        .getByRole('button', {
          name: locale === 'en-US' ? 'My club' : locale === 'ja-JP' ? 'マイクラブ' : '내 구단',
          exact: true,
        })
        .click();
      await page.locator('[data-act="open-membership"]').click();
      await expect(page.locator('[data-membership-app-only]')).toContainText(
        locale === 'en-US'
          ? 'Subscribe in the OFFSIDE app'
          : locale === 'ja-JP'
            ? '登録はオフサイドアプリ'
            : '구독 가입은 오프사이드 앱',
      );
      await page
        .getByRole('button', {
          name: locale === 'en-US' ? 'Royal' : locale === 'ja-JP' ? 'ロイヤル' : '로열',
          exact: true,
        })
        .click();
      await page
        .getByRole('button', {
          name:
            locale === 'en-US'
              ? 'Save appearance'
              : locale === 'ja-JP'
                ? '外観を保存'
                : '꾸미기 저장',
          exact: true,
        })
        .click();
      await expect.poll(() => saved).toEqual({ theme: 'royal', frame: 'none' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(
        page.getByRole('button', { name: /Start monthly|월간 구독 시작|月額メンバーシップに登録/ }),
      ).toHaveCount(0);
    });
  });
