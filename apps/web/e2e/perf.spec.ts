// T-1-014: 허브 LCP·폰트 CLS 재측정. T-0-013 기준선(decision-log.md, 4G LCP 2519ms·CLS 0)과
// 비교한다 — 그때는 허브 화면 자체가 없었다(Phase 0 껍데기). 지금은 실제 Phase 1 허브(카드 3장)로
// 다시 잰다. `E2E_PREVIEW=1`(playwright.config.ts)일 때만 돈다 — 실제 빌드(`vite build && vite
// preview`, 포트 5175) 대상이어야 dev 서버 미압축 번들이 아니라 배포본에 가까운 값이 나온다.
//
// 목표(LCP 2.5초·CLS 0.1)는 assert하지 않는다(브리프 6번) — 중앙값을 기록해 완료 조건 표·PR 본문에
// 옮긴다. 실 네트워크 접근은 없다: E2E_PREVIEW 모드는 apps/api를 띄우지 않고, 커리어 카드는 전부
// 로컬 IndexedDB(엔진의 로컬 스토어)에만 쓴다 — 백그라운드 동기화가 실패해도(로컬 8787 미기동,
// connection refused) UI를 막지 않는다(SyncBadge가 RETRYING/OFFLINE으로 표시할 뿐).
import { expect, test } from '@playwright/test';
import { expectRoute } from './helpers/route.js';

const WITH_PREVIEW = process.env.E2E_PREVIEW === '1';

test.describe('허브 LCP·CLS(4G, vite preview 빌드)', () => {
  test.skip(!WITH_PREVIEW, 'E2E_PREVIEW=1일 때만 실제 빌드 대상으로 측정한다');

  test('커리어 카드 3장이 있는 허브의 LCP·CLS를 4G에서 3회 측정해 중앙값을 기록한다', async ({
    page,
  }) => {
    // 카드 3장을 실제 UI로 만든다(로컬 IndexedDB에만 쓰인다, 네트워크 없음) — 매번 SCR-002는 허브로
    // 돌아가는 링크가 없어(hub.spec.ts와 같은 이유) 직접 이동한다.
    for (let i = 0; i < 3; i += 1) {
      await page.goto('/onboarding');
      await page.getByLabel('이름').fill('김서준');
      await page.getByRole('button', { name: /다음 · 후보 카드 열기/ }).click();
      await expectRoute(page, /\/career\/.+\/style$/);
    }
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: '김서준' })).toHaveCount(3);

    // LCP·layout-shift 관찰자를 페이지 생애주기 동안 계속 심어 둔다(매 goto마다 새로 실행된다).
    await page.addInitScript(() => {
      const w = window as unknown as { __perf: { lcp: number; cls: number } };
      w.__perf = { lcp: 0, cls: 0 };
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { renderTime?: number; loadTime?: number };
            w.__perf.lcp =
              e.renderTime && e.renderTime > 0 ? e.renderTime : (e.loadTime ?? w.__perf.lcp);
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // 브라우저가 largest-contentful-paint를 지원하지 않으면 0으로 남는다(측정 실패를 그대로 보고).
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!e.hadRecentInput) w.__perf.cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {
        // layout-shift 미지원 브라우저는 0으로 남는다.
      }
    });

    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    // 08/decision-log.md T-0-013과 같은 기준: 4G(다운 4Mbps, RTT 150ms). 업로드는 별도 명세가 없어
    // 표준 4G 프로파일값(업 3Mbps)을 그대로 쓴다 — 허브는 초기 로드 시 업로드가 없어 측정에 영향이
    // 없다.
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (4 * 1024 * 1024) / 8,
      uploadThroughput: (3 * 1024 * 1024) / 8,
      latency: 150,
    });

    const lcpValues: number[] = [];
    const clsValues: number[] = [];
    for (let run = 0; run < 3; run += 1) {
      await page.goto('/', { waitUntil: 'load' });
      await expect(page.getByRole('heading', { level: 2, name: '김서준' })).toHaveCount(3);
      // LCP 후보는 페이지가 완전히 자리 잡은 뒤(폰트 로드 포함)에야 최종값이 된다 — 폰트 로드까지
      // 상태 기반으로 기다린다.
      await page.evaluate(() => document.fonts.ready);
      const perf = await page.evaluate(
        () => (window as unknown as { __perf: { lcp: number; cls: number } }).__perf,
      );
      lcpValues.push(perf.lcp);
      clsValues.push(perf.cls);
    }

    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    const median = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)]!;
    };

    const result = {
      lcpMsRuns: lcpValues,
      clsRuns: clsValues,
      lcpMsMedian: median(lcpValues),
      clsMedian: median(clsValues),
    };
    console.log(`[perf] 허브 LCP·CLS(4G, 카드 3장): ${JSON.stringify(result)}`);
    console.log(
      `[perf] T-0-013 기준선(빈 Phase 0 껍데기) 대비: LCP 2519ms → ${result.lcpMsMedian.toFixed(0)}ms, CLS 0 → ${result.clsMedian.toFixed(3)} ` +
        `(목표 LCP 2.5초·CLS 0.1은 assert하지 않는다 — 브리프 6번, 표에 기록만 한다).`,
    );

    expect(lcpValues.length).toBe(3);
  });
});
