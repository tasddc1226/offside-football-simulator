import type { Platform } from '@offside/platform/types';
import { tossPlatform } from '@offside/platform/toss';
import { createWebPlatform } from '@offside/platform/web';
import { API_BASE_URL } from '../api/client.js';

/**
 * 채널 선택은 이 파일 한 곳에서만 한다(ADR-009). 다른 화면·엔진 코드는 `platform`이 주는 값만
 * 보고 `'toss'`·`'web'` 리터럴을 비교하지 않는다 — lint(`noChannelBranchRules`)가 강제한다.
 */
export const platform: Platform =
  import.meta.env.MODE === 'toss'
    ? tossPlatform
    : createWebPlatform({ analyticsEndpoint: `${API_BASE_URL}/v1/analytics/events`, dev: import.meta.env.DEV });
