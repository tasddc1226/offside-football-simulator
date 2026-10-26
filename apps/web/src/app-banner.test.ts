import { describe, it, expect } from 'vitest';
import { withCampaignBanner } from './app-banner.js';
const html = '<html><meta name="apple-itunes-app" content="app-id=6817463687" /></html>';
const shell = () =>
  new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      ETag: 'shared',
      'Content-Length': '80',
      'Cache-Control': 'public, max-age=300',
    },
  });
describe('initial HTML Safari banner', () => {
  it('uses only safe campaign dimensions and disables shared caching', async () => {
    const r = await withCampaignBanner(
      shell(),
      new URL(
        'https://offside.invalid/?utm_source=meta&utm_medium=paid&utm_campaign=global_test&utm_content=jp_a&fbclid=PRIVATE&email=PRIVATE',
      ),
      '123456',
    );
    const body = await r.text();
    expect(body).toContain('affiliate-data=pt=123456&amp;ct=os1.');
    expect(body).not.toContain('PRIVATE');
    expect(r.headers.get('ETag')).toBeNull();
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('preserves generic banner and cache when no verified configuration or campaign is available', async () => {
    for (const [path, token] of [
      ['/?utm_source=meta&utm_campaign=global_test', undefined],
      ['/', '123456'],
      ['/legal/privacy/?utm_source=meta&utm_campaign=global_test', '123456'],
    ] as const) {
      const r = await withCampaignBanner(shell(), new URL('https://offside.invalid' + path), token);
      expect(await r.text()).toBe(html);
      expect(r.headers.get('ETag')).toBe('shared');
    }
  });
});
