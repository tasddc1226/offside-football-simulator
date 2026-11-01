import { describe, expect, it } from 'vitest';
import { storeRedirect } from './store-redirect.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15';
const at = (q: string) => new URL(`https://offside-lab.com/get${q}`);

describe('storeRedirect (T-11-584 랜딩 스토어 버튼 · QR)', () => {
  it('QR은 기기를 보고 스토어를 고르고, PC는 랜딩으로 돌려보낸다', () => {
    expect(storeRedirect(at('?p=qr'), IPHONE, '123')).toMatch(
      /^https:\/\/apps\.apple\.com\/kr\/app\/id6817463687\?pt=123&ct=os1\./,
    );
    expect(storeRedirect(at('?p=qr'), ANDROID)).toMatch(
      /^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.offsidelab\.app&referrer=/,
    );
    expect(storeRedirect(at('?p=qr'), MAC)).toBe('/app/');
  });

  it('캠페인 없이 오면 랜딩 꼬리표를, 광고로 왔으면 그 캠페인을 넘긴다', () => {
    const own = new URL(storeRedirect(at('?os=android&p=dock'), MAC));
    expect(new URLSearchParams(own.searchParams.get('referrer') ?? '').get('utm_content')).toBe(
      'lp_dock',
    );
    const ad = new URL(
      storeRedirect(
        at(
          '?os=android&p=hero&utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=kr_reels',
        ),
        IPHONE,
      ),
    );
    const referrer = new URLSearchParams(ad.searchParams.get('referrer') ?? '');
    expect(referrer.get('utm_source')).toBe('meta');
    expect(referrer.get('utm_content')).toBe('kr_reels');
  });

  it('모르는 자리 값은 첫 화면으로 센다', () => {
    const url = new URL(storeRedirect(at('?os=android&p=<x>'), ANDROID));
    expect(new URLSearchParams(url.searchParams.get('referrer') ?? '').get('utm_content')).toBe(
      'lp_hero',
    );
  });
});
