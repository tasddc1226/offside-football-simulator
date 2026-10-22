// T-11-433 은퇴 기록의 서버 반영 상태(대기 · 보내는 중 · 완료 · 거절)와 거절 사유 기록.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stored = new Map<string, string>();
const local = {
  getItem: (k: string) => stored.get(k) ?? null,
  setItem: (k: string, v: string) => void stored.set(k, v),
};
const CID = '11111111-1111-1111-1111-111111111111';
const summary = {
  retireAge: 34,
  peak: 80,
  legendScore: 300,
  apps: 1,
  goals: 1,
  assists: 1,
  trophies: 0,
  awards: 0,
  caps: 0,
  ballon: 0,
  lastClub: 'FC',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const rejectWith = (status: number, code: string, reason?: string) =>
  json(status, {
    error: { code, message: 'x', retryable: false, ...(reason ? { details: { reason } } : {}) },
  });
/** 프로필 확인은 통과시키고 PUT에는 put()의 응답을 준다. */
function stubFetch(put: () => Response | Promise<Response>) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'PUT' ? put() : json(200, { data: {} }),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', local);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('은퇴 업로드 상태', () => {
  it('큐에 없고 거절 기록도 없으면 완료', async () => {
    const { retirementUploadStatus } = await import('./outboxStore.js');
    expect(retirementUploadStatus(CID)).toEqual({ state: 'done' });
  });

  it('서버에 닿지 못하면(5xx) 대기로 남고, 보내는 동안은 보내는 중이다', async () => {
    let seen: string | undefined;
    const { enqueueRetirement, flushOutbox, retirementUploadStatus } = await import('./outbox.js');
    stubFetch(() => {
      seen = retirementUploadStatus(CID).state;
      return json(503, {});
    });
    enqueueRetirement(CID, summary as never);
    await flushOutbox();
    expect(seen).toBe('sending');
    expect(retirementUploadStatus(CID)).toEqual({ state: 'pending' });
  });

  it('은퇴 앞 시즌이 큐에 남아 있어도 대기다', async () => {
    const { persistUpload, retirementUploadStatus } = await import('./outboxStore.js');
    persistUpload({ kind: 'season', careerId: CID, year: 2026, body: {} as never });
    expect(retirementUploadStatus(CID)).toEqual({ state: 'pending' });
  });

  it('4xx 거절은 사유와 함께 기기에 남고, 상태가 거절로 바뀐다', async () => {
    stubFetch(() => rejectWith(400, 'VALIDATION_FAILED', 'NO_SEASONS'));
    const { enqueueRetirement, flushOutbox, retirementUploadStatus, onUploadStatus } =
      await import('./outbox.js');
    const changed = vi.fn();
    const off = onUploadStatus(changed);
    enqueueRetirement(CID, summary as never);
    await flushOutbox();
    off();
    expect(retirementUploadStatus(CID)).toEqual({ state: 'rejected', reason: 'noSeasons' });
    expect(changed).toHaveBeenCalled();
    const [rejected] = JSON.parse(stored.get('ft_outbox:rejected')!);
    expect(rejected.rejected).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      reason: 'NO_SEASONS',
    });
    // 같은 항목이 다시 거절돼도 기록은 하나다.
    enqueueRetirement(CID, summary as never);
    await flushOutbox();
    expect(JSON.parse(stored.get('ft_outbox:rejected')!)).toHaveLength(1);
  });

  it('사유 코드를 사람이 읽을 이유로 묶는다', async () => {
    const { rejectReasonOf } = await import('./outboxStore.js');
    const r = (code: string, reason?: string) =>
      rejectReasonOf({ status: 400, code, ...(reason ? { reason } : {}), at: 0 });
    expect(r('VALIDATION_FAILED', 'CAREER_NOT_FOUND')).toBe('noSeasons');
    expect(r('VALIDATION_FAILED', 'PUBLIC_NAME_REJECTED')).toBe('name');
    expect(r('VALIDATION_FAILED', 'BODY_TOO_LARGE')).toBe('tooLarge');
    expect(r('VALIDATION_FAILED')).toBe('invalid');
    expect(r('CAREER_OWNER_MISMATCH')).toBe('owner');
    expect(r('FORBIDDEN')).toBe('unknown');
    expect(rejectReasonOf(undefined)).toBe('unknown');
  });

  it('T-11-433 전 저장값(사유 없는 거절 항목)도 거절로 읽는다', async () => {
    stored.set(
      'ft_outbox:rejected',
      JSON.stringify([{ kind: 'retirement', careerId: CID, body: summary, revision: 1 }]),
    );
    const { retirementUploadStatus } = await import('./outboxStore.js');
    expect(retirementUploadStatus(CID)).toEqual({ state: 'rejected', reason: 'unknown' });
  });

  it('다른 계정 소유(409)면 충돌 알림과 함께 거절로 남는다', async () => {
    stubFetch(() => rejectWith(409, 'CAREER_OWNER_MISMATCH'));
    const { configureOutbox, enqueueRetirement, flushOutbox, retirementUploadStatus } =
      await import('./outbox.js');
    const onConflict = vi.fn();
    configureOutbox({ onConflict });
    enqueueRetirement(CID, summary as never);
    await flushOutbox();
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(retirementUploadStatus(CID)).toEqual({ state: 'rejected', reason: 'owner' });
  });

  it('다시 올려 성공하면 지난 거절 기록을 지우고 완료가 된다', async () => {
    stored.set(
      'ft_outbox:rejected',
      JSON.stringify([
        { kind: 'retirement', careerId: CID, body: summary, rejected: { status: 400, at: 0 } },
        { kind: 'retirement', careerId: 'other', body: summary },
      ]),
    );
    stubFetch(() => json(200, { data: {} }));
    const { enqueueRetirement, flushOutbox, retirementUploadStatus } = await import('./outbox.js');
    enqueueRetirement(CID, { ...summary, publicName: null } as never);
    await flushOutbox();
    expect(retirementUploadStatus(CID)).toEqual({ state: 'done' });
    expect(JSON.parse(stored.get('ft_outbox:rejected')!)).toHaveLength(1);
  });
});

describe('상태 문구', () => {
  it('완료는 줄을 그리지 않고, 대기만 다시 올리기를 둔다', async () => {
    const { uploadStatusLine, retryResultText } = await import('./shareLink.js');
    expect(uploadStatusLine({ state: 'done' })).toBeNull();
    expect(uploadStatusLine({ state: 'pending' })).toEqual({
      text: '서버 반영 대기 중이에요.',
      retry: true,
    });
    expect(uploadStatusLine({ state: 'sending' })?.retry).toBe(false);
    expect(uploadStatusLine({ state: 'rejected', reason: 'name' })).toEqual({
      text: '서버에 올리지 못했어요. 공개할 수 없는 이름이에요. 이름 공개를 끄면 다시 올려요.',
      retry: false,
    });
    expect(retryResultText({ state: 'done' })).toBe('기록을 서버에 올렸어요.');
    expect(retryResultText({ state: 'pending' })).toContain('아직 서버에 닿지 않았어요');
    expect(retryResultText({ state: 'rejected', reason: 'noSeasons' })).toContain(
      '시즌 기록이 서버에 없어서',
    );
  });
});
