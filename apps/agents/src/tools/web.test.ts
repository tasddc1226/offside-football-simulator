import { describe, expect, it, vi } from 'vitest';
import { htmlText, readableUrl, webTools } from './web.ts';

describe('외부 링크 읽기 (T-11-332)', () => {
  it('공개 http · https만 받는다', () => {
    expect(readableUrl('https://gall.dcinside.com/mgallery/board/view/?id=x&no=1')).toBeDefined();
    for (const bad of [
      'file:///etc/passwd',
      'http://localhost:8787/v1',
      'http://10.0.0.2/',
      'http://169.254.169.254/latest',
      'https://offside-lab.slack.com/archives/C1',
      'https://offside-api.x.workers.dev/',
      'https://user:pw@example.com/',
      'not a url',
    ])
      expect(readableUrl(bad), bad).toBeUndefined();
  });

  it('HTML은 스크립트 · 태그를 지우고 글자만 남긴다', () => {
    expect(
      htmlText(
        '<html><head><title>t</title></head><body><script>x()</script><p>첫 줄&nbsp;&amp;</p><div>둘째</div></body></html>',
      ),
    ).toBe('첫 줄 &\n둘째');
  });

  it('운영자 지시에만 있고, 읽은 글은 page 태그로 감싸 앞부분만 준다', async () => {
    expect(webTools('triage')).toEqual([]);
    const fetcher = vi.fn(
      async () =>
        new Response('<p>' + '가'.repeat(9000) + '</p>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    );
    const out = await webTools('mention', fetcher as unknown as typeof fetch)[0]!.run({
      url: 'https://example.com/post',
    });
    expect(out.startsWith('<page url="https://example.com/post">\n가')).toBe(true);
    expect(out.length).toBeLessThan(8100);
    expect(
      await webTools('mention', fetcher as unknown as typeof fetch)[0]!.run({
        url: 'http://127.0.0.1',
      }),
    ).toBe('읽을 수 없는 주소예요(공개 http · https만)');
  });
});
