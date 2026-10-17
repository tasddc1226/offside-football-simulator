// ADR-015 Worker 바인딩 · 비밀값. 비밀값은 `wrangler secret put`으로만 넣는다(공개 저장소).
import type { WorkCard } from './card.ts';
import type { AgentLedger } from './ledger.ts';
import type { AgentThread } from './thread.ts';

export const ROLES = ['ops', 'plan', 'dev', 'mkt'] as const;
export type Role = (typeof ROLES)[number];

export interface Env {
  THREAD: DurableObjectNamespace<AgentThread>;
  LEDGER: DurableObjectNamespace<AgentLedger>;
  /** T-11-325 스레드마다 작업 카드 하나. */
  CARD: DurableObjectNamespace<WorkCard>;
  ENABLED_ROLES: string;
  OPERATOR_USER_ID: string;
  AGENT_APP_IDS: string;
  AGENT_BOT_USERS: string;
  ALERT_CHANNELS: string;
  CF_ACCOUNT_ID: string;
  D1_DATABASE_ID: string;
  GITHUB_REPO: string;
  /** 운영 API 주소(라운지 채팅 내부 읽기). */
  API_BASE: string;
  /** 유저 반응 정리를 올릴 채널(#agent-desk). */
  DESK_CHANNEL: string;
  TASK_BUDGET_USD: string;
  DAILY_BUDGET_USD: string;
  /** @dev 하루 한도(Actions 작업 비용 포함). 없으면 DAILY_BUDGET_USD. */
  DAILY_BUDGET_DEV_USD?: string;
  /** agent-dev.yml의 `--max-budget-usd`와 같은 값. 남은 하루 한도가 이보다 적으면 작업을 띄우지 않는다. */
  DEV_RUN_BUDGET_USD: string;
  /** 승인 카드를 올릴 채널(#agent-approvals). */
  APPROVAL_CHANNEL: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_INSTALLATION_ID: string;
  /** PKCS#8 PEM. */
  GITHUB_APP_PRIVATE_KEY?: string;
  /** 고객 문의(T-11-291): 문의를 받는 Gmail 검색 조건(예: `to:contact@offside-lab.com`). */
  SUPPORT_QUERY: string;
  /**
   * 답장 보내는 사람. Gmail "다른 주소에서 메일 보내기"에 등록된 별칭과 같아야 그 별칭(Cloudflare SMTP)으로 나간다.
   * 도메인이 DMARC p=reject라 contact@는 Cloudflare를 거쳐야 한다. 없으면 Gmail 기본 주소로 나간다.
   */
  SUPPORT_FROM?: string;
  /** Google OAuth(gmail.readonly · gmail.compose). 없으면 고객 문의를 돌리지 않는다. */
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  /** 드림보트 받기 · 보내기 주소(키가 들어 있어 비밀값, T-11-296). 없으면 @mkt 요약을 돌리지 않는다. */
  DREAMBOAT_URL?: string;
  /** @mkt GA4 읽기(T-11-299): 서비스 계정 비공개 키(PKCS#8 PEM) · 계정 메일(둘 다 비밀값) · 키 ID · 속성 ID. */
  GA4_SA_KEY?: string;
  GA4_SA_EMAIL?: string;
  GA4_KEY_ID?: string;
  GA4_PROPERTY_ID?: string;
  /**
   * 스토어 리뷰(T-11-328). App Store Connect API 키(고객 지원 권한): 키 ID · 발급자 ID · 비공개 키(PKCS#8 PEM, 비밀값) · 앱 ID.
   * Google Play: 패키지 이름과 서비스 계정(Play Console "리뷰에 답글" 권한). 서비스 계정이 없으면 GA4 계정을 쓴다.
   */
  ASC_KEY_ID?: string;
  ASC_ISSUER_ID?: string;
  ASC_PRIVATE_KEY?: string;
  ASC_APP_ID?: string;
  PLAY_PACKAGE?: string;
  PLAY_SA_EMAIL?: string;
  PLAY_SA_KEY?: string;
  PLAY_KEY_ID?: string;
  /** T-11-332 EAS 빌드 · OTA 읽기(Expo 액세스 토큰). */
  EXPO_TOKEN?: string;
  /** T-11-332 Meta 광고 성과 읽기(없으면 meta_ads 도구가 없다). */
  META_ADS_ACCESS_TOKEN?: string;
  META_AD_ACCOUNT_ID?: string;
  CF_D1_READ_TOKEN: string;
  CF_MCP_TOKEN?: string;
  GITHUB_TOKEN?: string;
  /** offside-api `AGENTS_READ_TOKEN`과 같은 값. 작성자 가명의 소금으로도 쓴다. */
  AGENTS_READ_TOKEN: string;
  ANTHROPIC_OPS_API_KEY: string;
  ANTHROPIC_PLAN_API_KEY: string;
  ANTHROPIC_DEV_API_KEY: string;
  ANTHROPIC_MKT_API_KEY: string;
  SLACK_OPS_BOT_TOKEN: string;
  SLACK_PLAN_BOT_TOKEN: string;
  SLACK_DEV_BOT_TOKEN: string;
  SLACK_MKT_BOT_TOKEN: string;
  SLACK_OPS_SIGNING_SECRET: string;
  SLACK_PLAN_SIGNING_SECRET: string;
  SLACK_DEV_SIGNING_SECRET: string;
  SLACK_MKT_SIGNING_SECRET: string;
}

export const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** 슬랙에 보이는 이름(T-11-281). 넘기기 줄 · 설정 키는 역할 키(ops · plan · dev · mkt)를 그대로 쓴다. */
export const ROLE_NAMES: Record<Role, string> = {
  ops: '이운재 · 운영',
  plan: '박지성 · 기획',
  dev: '손흥민 · 개발',
  mkt: '안정환 · 마케팅',
};

/** 슬랙에서 한글로 부르는 이름(T-11-283). 슬랙 멘션은 영어 표시 이름만 찾아서, 운영자가 `@이운재`처럼 글로 쓰면 Worker가 멘션으로 받는다. */
export const ROLE_CALLS: Record<Role, readonly string[]> = {
  ops: ['이운재', '운영'],
  plan: ['박지성', '기획'],
  dev: ['손흥민', '개발'],
  mkt: ['안정환', '마케팅'],
};

const CALL = new RegExp(`@(${Object.values(ROLE_CALLS).flat().join('|')})(?![가-힣])`, 'g');

/** 한글 이름 · 역할 이름(`이운재` · `운영`)을 역할 키로. */
export const roleOfCall = (name: string): Role | undefined =>
  (Object.keys(ROLE_CALLS) as Role[]).find((r) => ROLE_CALLS[r].includes(name));

/** 글에서 `@이운재` · `@운영` 꼴로 부른 역할들. */
export const calledRoles = (text: string): Role[] => [
  ...new Set([...text.matchAll(CALL)].map((m) => roleOfCall(m[1]!)!)),
];

export const stripCalls = (text: string) => text.replace(CALL, '').trim();

/** 역할별 하루 한도(달러). */
export const dailyBudget = (env: Env, role: Role) =>
  Number((role === 'dev' && env.DAILY_BUDGET_DEV_USD) || env.DAILY_BUDGET_USD);

export const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);
export const enabled = (env: Env, role: Role) => list(env.ENABLED_ROLES).includes(role);

const KEY = (role: Role) => role.toUpperCase() as Uppercase<Role>;
export const apiKey = (env: Env, role: Role) => env[`ANTHROPIC_${KEY(role)}_API_KEY`];
export const botToken = (env: Env, role: Role) => env[`SLACK_${KEY(role)}_BOT_TOKEN`];
export const signingSecret = (env: Env, role: Role) => env[`SLACK_${KEY(role)}_SIGNING_SECRET`];
