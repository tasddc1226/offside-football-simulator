// T-11-535 유저 반응 추적표(구글 시트). @plan이 반응 살피기에서 검토할 이야기를 "주제" 한 줄로 쌓고, 같은 주제가
// 다시 나오면 새 줄 대신 언급 수 · 마지막 날짜만 올린다. 운영자는 시트에서 상태 · 메모를 바꾼다(Worker는 메모를 쓰지 않는다).
// 인증은 GA4 서비스 계정(시트에 편집자로 공유). 유저 원문 · 닉네임 · 가명은 남기지 않고 요약만 쓴다.
import type { Tool } from './claude.ts';
import type { Env } from './env.ts';
import { serviceAccountToken } from './google.ts';
import { kstDay } from './ledger.ts';
import type { Task } from './thread.ts';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export const VOICE_HEADER = [
  '키',
  '주제',
  '종류',
  '상태',
  '언급',
  '게임 댓글',
  '라운지',
  '디시',
  '처음',
  '마지막',
  '판단',
  '근거',
  '메모',
] as const;
const COLS = 'A:M';
export const VOICE_KINDS = ['버그 의심', '개선 제안', '요구사항'] as const;
export const VOICE_STATES = ['새로', '확인', '작업 중', '반영', '안 함', '재언급'] as const;
/** 닫힌 주제가 다시 나오면 상태를 이것으로 올려 운영자 눈에 띄게 한다. */
const REOPEN = new Set(['반영', '안 함']);
const ROWS_MAX = 500;

export type VoiceRow = {
  /** 시트 줄 번호(1부터, 머리줄이 1). */
  line: number;
  key: string;
  topic: string;
  kind: string;
  status: string;
  comment: number;
  lounge: number;
  dc: number;
  first: string;
  last: string;
  note: string;
  link: string;
  memo: string;
};

export type VoiceLog = {
  key?: string;
  topic?: string;
  kind?: string;
  comment?: number;
  lounge?: number;
  dc?: number;
  note?: string;
  link?: string;
  /** 운영자 지시에서만 받는다(유저 글이 들어온 반응 살피기에서는 무시). */
  status?: string;
};

const num = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 0;
};
const cell = (v: unknown, max = 300) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export function parseRows(values: string[][]): VoiceRow[] {
  return values
    .slice(1)
    .map((r, i) => ({
      line: i + 2,
      key: cell(r[0], 60),
      topic: cell(r[1]),
      kind: cell(r[2]),
      status: cell(r[3]),
      comment: num(r[5]),
      lounge: num(r[6]),
      dc: num(r[7]),
      first: cell(r[8]),
      last: cell(r[9]),
      note: cell(r[10]),
      link: cell(r[11], 500),
      memo: cell(r[12]),
    }))
    .filter((r) => r.key);
}

const rowValues = (r: Omit<VoiceRow, 'line'>) => [
  r.key,
  r.topic,
  r.kind,
  r.status,
  r.comment + r.lounge + r.dc,
  r.comment,
  r.lounge,
  r.dc,
  r.first,
  r.last,
  r.note,
  r.link,
];

/**
 * 기록 하나를 표에 합친다. 있는 키면 언급을 더하고 마지막 · 판단 · 근거를 갈고, 닫힌 주제면 "재언급"으로 올린다.
 * 없는 키면 새 줄(상태 "새로"). 메모(운영자 칸)는 건드리지 않는다.
 */
export function mergeLog(
  rows: VoiceRow[],
  log: VoiceLog,
  today: string,
  allowStatus: boolean,
): { row: Omit<VoiceRow, 'line'>; line?: number; created: boolean } | string {
  const key = cell(log.key, 60).toLowerCase();
  if (!key) return '키가 비었어요';
  const status =
    allowStatus && log.status && (VOICE_STATES as readonly string[]).includes(log.status)
      ? log.status
      : undefined;
  const kind =
    log.kind && (VOICE_KINDS as readonly string[]).includes(log.kind) ? log.kind : undefined;
  const hit = rows.find((r) => r.key.toLowerCase() === key);
  const add = { comment: num(log.comment), lounge: num(log.lounge), dc: num(log.dc) };
  const mentioned = add.comment + add.lounge + add.dc > 0;
  if (hit) {
    const { line, ...prev } = hit;
    return {
      line,
      created: false,
      row: {
        ...prev,
        topic: cell(log.topic) || prev.topic,
        kind: kind ?? prev.kind,
        status: status ?? (mentioned && REOPEN.has(prev.status) ? '재언급' : prev.status),
        comment: prev.comment + add.comment,
        lounge: prev.lounge + add.lounge,
        dc: prev.dc + add.dc,
        last: mentioned ? today : prev.last,
        note: cell(log.note) || prev.note,
        link: cell(log.link, 500) || prev.link,
      },
    };
  }
  const topic = cell(log.topic);
  if (!topic) return `새 주제(${key})에 주제 문장이 없어요`;
  return {
    created: true,
    row: {
      key,
      topic,
      kind: kind ?? '개선 제안',
      status: status ?? '새로',
      ...add,
      first: today,
      last: today,
      note: cell(log.note),
      link: cell(log.link, 500),
      memo: '',
    },
  };
}

type Sheets = {
  read: () => Promise<string[][]>;
  write: (data: { range: string; values: (string | number)[][] }[]) => Promise<void>;
};

function sheets(env: Env, fetcher: typeof fetch): Sheets {
  const id = env.VOICE_SHEET_ID!;
  const call = async (path: string, init?: RequestInit) => {
    const token = await serviceAccountToken(
      { email: env.GA4_SA_EMAIL!, key: env.GA4_SA_KEY!, keyId: env.GA4_KEY_ID },
      SCOPE,
      fetcher,
      'Sheets',
    );
    const r = await fetcher(`${API}/${id}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const body = (await r.json()) as { values?: string[][]; error?: { message?: string } };
    if (!r.ok) throw new Error(`Sheets ${r.status}: ${(body.error?.message ?? '').slice(0, 200)}`);
    return body;
  };
  return {
    read: async () => (await call(`/values/${COLS}`)).values ?? [],
    write: async (data) => {
      await call('/values:batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'RAW', data }),
      });
    },
  };
}

const line = (r: VoiceRow) =>
  `${r.key} | ${r.topic} | ${r.kind} | ${r.status} | 언급 ${r.comment + r.lounge + r.dc} | 마지막 ${r.last}${r.memo ? ` | 메모: ${r.memo}` : ''}`;

export const voiceEnabled = (env: Env) =>
  !!(env.VOICE_SHEET_ID && env.GA4_SA_KEY && env.GA4_SA_EMAIL && env.GA4_KEY_ID);

/** @plan 유저 반응 추적표 도구. 반응 살피기 · 운영자 지시 · 답글 · 넘겨받은 일에서 연다. */
export function voiceTools(env: Env, task: Task, fetcher: typeof fetch = fetch): Tool[] {
  if (!voiceEnabled(env) || !['triage', 'mention', 'reply', 'handoff'].includes(task.kind))
    return [];
  const allowStatus = task.kind !== 'triage';
  const api = () => sheets(env, fetcher);
  return [
    {
      name: 'voice_topics',
      description:
        '유저 반응 추적표(구글 시트)의 주제 목록: 키 | 주제 | 종류 | 상태 | 언급 수 | 마지막 언급일 | 운영자 메모. 반응을 기록하기 전에 한 번 불러 같은 주제가 이미 있는지 본다.',
      input_schema: { type: 'object', properties: {} },
      run: async () => {
        const rows = parseRows(await api().read());
        return rows.length ? rows.map(line).join('\n') : '주제 없음';
      },
    },
    {
      name: 'voice_log',
      description: `유저 반응 추적표에 주제를 기록한다. 이미 있는 주제는 그 키를 써서 이번에 말한 사람 수를 출처별로 더하고(새 줄을 만들지 않는다), 없으면 새 키(영문 소문자 · 숫자 · 하이픈, 예: high-chance-fail)로 새 줄을 만든다. 버그 의심 · 개선 제안 · 요구사항만 기록하고 그냥 반응은 기록하지 않는다. topic은 유저 원문이 아니라 짧은 요약(닉네임 · 선수명 없이), note는 판단 한 줄(이미 보드에 있음 / 원래 규칙 / 확인 필요 등), link는 디시 · 게임 댓글 원문 주소 하나.${allowStatus ? ` status(${VOICE_STATES.join(' · ')})는 운영자가 이 대화에서 상태를 바꾸라고 했을 때만 쓴다.` : ''} 한 번에 여러 주제를 넣는다.`,
      input_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                topic: { type: 'string', description: '주제 요약(새 주제면 필수, 80자 안)' },
                kind: { type: 'string', enum: [...VOICE_KINDS] },
                comment: { type: 'number', description: '이번에 게임 댓글에서 말한 사람 수' },
                lounge: { type: 'number', description: '이번에 라운지에서 말한 사람 수' },
                dc: { type: 'number', description: '이번에 디시에서 말한 사람 수' },
                note: { type: 'string' },
                link: { type: 'string' },
                ...(allowStatus ? { status: { type: 'string', enum: [...VOICE_STATES] } } : {}),
              },
              required: ['key'],
            },
          },
        },
        required: ['items'],
      },
      run: async (input) => {
        const items = Array.isArray(input.items) ? (input.items as VoiceLog[]).slice(0, 30) : [];
        if (!items.length) return '기록할 주제가 없어요';
        const s = api();
        const values = await s.read();
        const rows = parseRows(values);
        const today = kstDay();
        const data: { range: string; values: (string | number)[][] }[] = [];
        if (!values[0]?.length) data.push({ range: 'A1:M1', values: [[...VOICE_HEADER]] });
        let next = Math.max(values.length, 1) + 1;
        const done: string[] = [];
        for (const log of items) {
          const m = mergeLog(rows, log, today, allowStatus);
          if (typeof m === 'string') {
            done.push(`건너뜀: ${m}`);
            continue;
          }
          if (m.created && rows.length >= ROWS_MAX) {
            done.push(`건너뜀: 주제가 ${ROWS_MAX}개라 새 줄을 더 만들지 않아요(${m.row.key})`);
            continue;
          }
          const at = m.line ?? next++;
          data.push({ range: `A${at}:L${at}`, values: [rowValues(m.row)] });
          // 같은 호출 안에서 같은 새 키가 또 오면 방금 만든 줄에 합친다.
          const merged = { ...m.row, line: at };
          const i = rows.findIndex((r) => r.line === at);
          if (i >= 0) rows[i] = merged;
          else rows.push(merged);
          done.push(`${m.created ? '새 주제' : '갱신'}: ${m.row.key} (상태 ${m.row.status})`);
        }
        if (data.length) await s.write(data);
        return done.join('\n');
      },
    },
  ];
}
