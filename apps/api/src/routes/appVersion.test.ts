import { AppVersionResponseSchema, successEnvelope } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { APP_VERSIONS } from './appVersion.js';

describe('앱 최소 버전 /v1/app/version (T-11-042)', () => {
  let ctx: TestD1;
  beforeEach(async () => {
    ctx = await createTestD1();
  });
  afterEach(async () => {
    await ctx.dispose();
  });

  it('로그인 없이 플랫폼별 최소 버전과 스토어 주소를 준다', async () => {
    const res = await createApp().request('/v1/app/version', {}, ctx.env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('public');
    const data = successEnvelope(AppVersionResponseSchema).parse(await res.json()).data;
    expect(data).toEqual(APP_VERSIONS);
    expect(data.ios.url).toContain('apps.apple.com');
    expect(data.android.url).toContain('com.offsidelab.app');
  });
});
