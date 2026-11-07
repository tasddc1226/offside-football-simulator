import { describe, expect, it, vi } from 'vitest';
import { shareEventParams, type ShareOutcome } from '@offside/app-core/shareMeasurement';
import { runShareFlow, type ShareFlowDeps } from './shareFlow.js';

const URL_ = 'https://offside-lab.com/career/00000000-0000-4000-8000-000000000000';
const named = (name: string) => Object.assign(new Error(name), { name });

function setup(over: Partial<ShareFlowDeps> = {}) {
  const events: ShareOutcome[] = [];
  const links: string[] = [];
  const writeClipboard = vi.fn((link: Promise<string>) => link.then(() => undefined));
  const deps: ShareFlowDeps = {
    link: Promise.resolve(URL_),
    shareData: (url) => ({ title: 't', text: 'x', url }),
    writeClipboard,
    onLink: (u) => links.push(u),
    track: (o) => events.push(o),
    ...over,
  };
  const names = () => events.map((e) => shareEventParams(e).name);
  return { deps, events, links, names, writeClipboard: over.writeClipboard ?? writeClipboard };
}

describe('T-11-668 링크 공유 흐름 계측', () => {
  it('네이티브 공유 성공: preview → native_success, 복사 성공으로 세지 않는다', async () => {
    const share = vi.fn(() => Promise.resolve());
    const t = setup({ share });
    expect(await runShareFlow(t.deps)).toEqual({ kind: 'native' });
    expect(t.names()).toEqual(['career_share_preview', 'career_share_native_success']);
    expect(share).toHaveBeenCalledWith({ title: 't', text: 'x', url: URL_ });
    expect(t.writeClipboard).not.toHaveBeenCalled();
    expect(t.links).toEqual([URL_]);
  });

  it('시트를 닫으면(AbortError) cancel 하나만 남고 복사로 넘어가지 않는다', async () => {
    const t = setup({ share: () => Promise.reject(named('AbortError')) });
    expect(await runShareFlow(t.deps)).toEqual({ kind: 'cancel' });
    expect(t.names()).toEqual(['career_share_preview', 'career_share_cancel']);
    expect(t.writeClipboard).not.toHaveBeenCalled();
  });

  it('네이티브 실패 뒤 복사: failure(native)와 copy_success 가 각각 한 번', async () => {
    const t = setup({ share: () => Promise.reject(named('NotAllowedError')) });
    expect(await runShareFlow(t.deps)).toEqual({ kind: 'copied' });
    expect(t.events).toEqual([
      { kind: 'preview' },
      { kind: 'failure', method: 'native_share', stage: 'native', error: 'not_allowed' },
      { kind: 'copy_success' },
    ]);
  });

  it('네이티브 실패 뒤 복사도 실패: failure(native) · failure(copy)', async () => {
    const t = setup({
      share: () => Promise.reject(new TypeError('bad')),
      writeClipboard: () => Promise.reject(named('NotAllowedError')),
    });
    expect(await runShareFlow(t.deps)).toEqual({ kind: 'copy_failed' });
    expect(t.events).toEqual([
      { kind: 'preview' },
      { kind: 'failure', method: 'native_share', stage: 'native', error: 'invalid_data' },
      { kind: 'failure', method: 'copy_link', stage: 'copy', error: 'not_allowed' },
    ]);
  });

  it('canShare 가 false 면 preview 없이 바로 복사한다', async () => {
    const share = vi.fn(() => Promise.resolve());
    const t = setup({ share, canShare: () => false });
    expect(await runShareFlow(t.deps)).toEqual({ kind: 'copied' });
    expect(t.names()).toEqual(['career_share_copy_success']);
    expect(share).not.toHaveBeenCalled();
  });

  it('공유 시트가 없으면 클립보드 쓰기를 링크 확인 전에 바로 시작한다(Safari 제스처)', async () => {
    let resolve!: (v: string) => void;
    const link = new Promise<string>((r) => (resolve = r));
    const t = setup({ link });
    const run = runShareFlow(t.deps);
    expect(t.writeClipboard).toHaveBeenCalledWith(link);
    resolve(URL_);
    expect(await run).toEqual({ kind: 'copied' });
    expect(t.names()).toEqual(['career_share_copy_success']);
    expect(t.links).toEqual([URL_]);
  });

  it('복사 거절: failure(copy) 만, copy_success 는 없다', async () => {
    const t = setup({ writeClipboard: () => Promise.reject(named('NotAllowedError')) });
    expect(await runShareFlow(t.deps)).toEqual({ kind: 'copy_failed' });
    expect(t.events).toEqual([
      { kind: 'failure', method: 'copy_link', stage: 'copy', error: 'not_allowed' },
    ]);
  });

  it('클립보드 쓰기가 동기로 던져도 failure(copy)로 끝난다', async () => {
    const t = setup({
      writeClipboard: () => {
        throw new Error('no clipboard');
      },
    });
    expect(await runShareFlow(t.deps)).toEqual({ kind: 'copy_failed' });
    expect(t.events).toEqual([
      { kind: 'failure', method: 'copy_link', stage: 'copy', error: 'unknown' },
    ]);
  });

  it.each([
    ['native_share', true],
    ['copy_link', false],
  ] as const)(
    '링크 확인(업로드 준비) 실패: failure(%s, link)만, 시트 · 복사 성공 없음',
    async (method, native) => {
      const err = new Error('기록을 아직 올리지 못했어요');
      const share = vi.fn(() => Promise.resolve());
      const t = setup({ link: Promise.reject(err), ...(native ? { share } : {}) });
      const result = await runShareFlow(t.deps);
      expect(result).toEqual({ kind: 'link_failed', error: err });
      expect(t.events).toEqual([{ kind: 'failure', method, stage: 'link', error: 'unknown' }]);
      expect(share).not.toHaveBeenCalled();
      expect(t.links).toEqual([]);
    },
  );
});
