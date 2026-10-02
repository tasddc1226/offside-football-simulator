import { AppVersionResponseSchema, type AppVersionResponse } from '@offside/contracts';
import type { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { ok } from './shared.js';

/**
 * T-11-042 플랫폼별 최소 앱 버전과 스토어 주소. 앱이 켤 때·돌아올 때 묻고, 자기 버전이 낮으면 스토어 업데이트를 안내한다.
 * 새 시즌 빌드(`1.<시즌>.0`)가 **스토어에 출시된 뒤에** 그 플랫폼의 min을 올린다 — 먼저 올리면 받을 수 없는 업데이트를
 * 안내하게 된다. DB를 읽지 않는다.
 */
export const APP_VERSIONS: AppVersionResponse = {
  ios: { min: '1.0.0', url: 'https://apps.apple.com/kr/app/id6817463687' },
  android: {
    min: '1.0.0',
    url: 'https://play.google.com/store/apps/details?id=com.offsidelab.app',
  },
};
/** 바꾼 값이 이만큼 안에 퍼진다. */
const TTL_SEC = 300;

export function registerAppVersionRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/app/version', (c) =>
    ok(c, AppVersionResponseSchema, APP_VERSIONS, 200, `public, max-age=${TTL_SEC}`),
  );
}
