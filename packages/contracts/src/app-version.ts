import { z } from 'zod';

/**
 * T-11-042 스토어 앱 업데이트 안내. 앱 버전은 `1.<시즌>.<빌드>`(운영 배포 런북 "앱 버전 규칙")이고, 버전을 올린
 * 스토어 빌드부터 OTA 런타임이 바뀌어 옛 빌드에는 OTA가 가지 않는다. 그래서 서버가 플랫폼별 최소 버전과 스토어
 * 주소를 알려 주고, 앱은 자기 버전이 낮으면 스토어 업데이트를 안내한다.
 * T-11-464 `latest`(스토어에 나온 최신 버전)보다 낮으면 '나중에'가 있는 권장 팝업, `min`보다 낮으면 닫을 수 없는 팝업이다.
 */
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const StoreSchema = z.strictObject({ min: VersionSchema, latest: VersionSchema, url: z.url() });

/** `GET /v1/app/version` */
export const AppVersionResponseSchema = z.strictObject({
  ios: StoreSchema,
  android: StoreSchema,
});
export type AppVersionResponse = z.infer<typeof AppVersionResponseSchema>;
