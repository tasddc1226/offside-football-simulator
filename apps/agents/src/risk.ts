// ADR-015 6단계(T-11-325) 위험도. 바뀌는 파일 경로로 낮음 · 중간 · 높음을 정한다. 시작 전에는 주장이 적은 범위로,
// PR 뒤에는 실제 바뀐 경로(agent-dev-publish.mjs가 보낸 목록)로 다시 판정한다. 여러 파일이면 가장 높은 것.
export type Risk = 'low' | 'mid' | 'high';

export const RISK_LABEL: Record<Risk, string> = { low: '낮음', mid: '중간', high: '높음' };
const RANK: Record<Risk, number> = { low: 0, mid: 1, high: 2 };

/** 높음: 마이그레이션 · 결제 · 세이브 포맷 · 밸런스 스펙 · 인증 · 인프라 설정 · CI · 의존성 · 에이전트 자신. */
const HIGH = [
  /^apps\/api\/migrations\//,
  /^apps\/api\/src\/(auth|iap|profile)\//,
  /^apps\/api\/src\/db\/schema\.ts$/,
  /(^|\/)wrangler\.jsonc?$/,
  /^packages\/game\/src\/save\.ts$/,
  /^packages\/contracts\/src\/balance-spec\.ts$/,
  /^\.github\//,
  /^tooling\/scripts\/production-release\.mjs$/,
  /(^|\/)package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^apps\/mobile\/(app\.json|app\.config\.js|eas\.json|plugins\/|google-services\.json|firebase\.json)/,
  // 에이전트가 자기 권한 · 프롬프트를 바꾸지 못하게 한다.
  /^apps\/agents\//,
];

/** 낮음: 문서 · 다국어 사전 · 테스트 · 릴리즈 노트 · 화면 그리기. */
const LOW = [
  /^docs\//,
  /\/i18n\/(ko|en|ja)\//,
  /\.(test|spec)\.tsx?$/,
  /^apps\/web\/e2e\//,
  /^\.release-notes\//,
  /^tooling\/i18n-baseline\.json$/,
  /^apps\/web\/src\/ui\//,
  /^apps\/mobile\/src\/screens\//,
];

/** 운영 기준선 지식 파일은 에이전트 프롬프트에 들어가서 낮음으로 두지 않고, 에이전트 코드보다는 낮게 중간으로 둔다. */
const KNOWLEDGE = /^apps\/agents\/knowledge\/[^/]+\.md$/;

export function riskOfPath(path: string): Risk {
  const p = path.replace(/^\.?\//, '');
  if (KNOWLEDGE.test(p)) return 'mid';
  if (HIGH.some((re) => re.test(p))) return 'high';
  if (LOW.some((re) => re.test(p))) return 'low';
  return 'mid';
}

/** 파일 목록의 위험도. 목록이 비면 범위를 모르는 것이라 중간으로 본다. */
export function riskOf(paths: readonly string[]): Risk {
  if (!paths.length) return 'mid';
  return paths.map(riskOfPath).reduce((a, b) => higher(a, b));
}

export const higher = (a: Risk, b: Risk): Risk => (RANK[a] >= RANK[b] ? a : b);
export const above = (a: Risk, b: Risk) => RANK[a] > RANK[b];
export const isRisk = (v: unknown): v is Risk => v === 'low' || v === 'mid' || v === 'high';
