// 공개 이름 신고 API(앱스토어 UGC 정책). 타입은 type-only import라 번들에 zod가 들어가지 않는다.
import type { NameReportInput } from '@offside/contracts';
import { apiFetch, withProfile } from './client.js';

/** 명예의 전당 선수 이름·구단 이름 신고(운영자가 가리거나 기각한다). */
export const reportName = (input: NameReportInput) =>
  withProfile(() =>
    apiFetch<undefined>('/v1/reports/names', { method: 'POST', body: JSON.stringify(input) }),
  );
