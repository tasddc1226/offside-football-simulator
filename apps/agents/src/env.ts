// ADR-015 Worker 바인딩 · 비밀값. 비밀값은 `wrangler secret put`으로만 넣는다(공개 저장소).
import type { AgentLedger } from './ledger.ts';
import type { AgentThread } from './thread.ts';

export const ROLES = ['ops', 'plan', 'dev', 'mkt'] as const;
export type Role = (typeof ROLES)[number];

export interface Env {
  THREAD: DurableObjectNamespace<AgentThread>;
  LEDGER: DurableObjectNamespace<AgentLedger>;
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

export const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);
export const enabled = (env: Env, role: Role) => list(env.ENABLED_ROLES).includes(role);

const KEY = (role: Role) => role.toUpperCase() as Uppercase<Role>;
export const apiKey = (env: Env, role: Role) => env[`ANTHROPIC_${KEY(role)}_API_KEY`];
export const botToken = (env: Env, role: Role) => env[`SLACK_${KEY(role)}_BOT_TOKEN`];
export const signingSecret = (env: Env, role: Role) => env[`SLACK_${KEY(role)}_SIGNING_SECRET`];
