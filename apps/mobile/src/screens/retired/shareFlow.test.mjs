// T-11-676 앱 은퇴 커리어 공유 흐름의 순서와 계측(웹 shareFlow와 같은 이벤트). RN Share · 클립보드는 함수로 흉내 낸다.
import { describe, expect, it, vi } from 'vitest';
import { runNativeShare } from './shareFlow';

const URL_ = 'https://offside-lab.com/career/x?utm_source=offside_app&utm_medium=share';

function deps(over = {}) {
  const events = [];
  const d = {
    link: vi.fn(async () => URL_),
    share: vi.fn(async () => 'shared'),
    copy: vi.fn(async () => {}),
    track: (o) => events.push(o.kind === 'failure' ? `failure:${o.method}:${o.stage}` : o.kind),
    ...over,
  };
  return { d, events };
}

describe('runNativeShare', () => {
  it('시트에서 대상을 고르면 click → preview → native_success', async () => {
    const { d, events } = deps();
    await expect(runNativeShare(d)).resolves.toEqual({ kind: 'native' });
    expect(events).toEqual(['click', 'preview', 'native_success']);
    expect(d.share).toHaveBeenCalledWith(URL_);
    expect(d.copy).not.toHaveBeenCalled();
  });

  it('시트를 닫으면 cancel로 조용히 끝나고 복사하지 않는다', async () => {
    const { d, events } = deps({ share: vi.fn(async () => 'dismissed') });
    await expect(runNativeShare(d)).resolves.toEqual({ kind: 'cancel' });
    expect(events).toEqual(['click', 'preview', 'cancel']);
    expect(d.copy).not.toHaveBeenCalled();
  });

  it('시트가 실패하면 failure(native) 뒤 복사로 넘어간다', async () => {
    const { d, events } = deps({ share: vi.fn(async () => Promise.reject(new Error('x'))) });
    await expect(runNativeShare(d)).resolves.toEqual({ kind: 'copied' });
    expect(events).toEqual(['click', 'preview', 'failure:native_share:native', 'copy_success']);
    expect(d.copy).toHaveBeenCalledWith(URL_);
  });

  it('복사도 실패하면 failure(copy)', async () => {
    const { d, events } = deps({
      share: vi.fn(async () => Promise.reject(new Error('x'))),
      copy: vi.fn(async () => Promise.reject(new Error('y'))),
    });
    await expect(runNativeShare(d)).resolves.toEqual({ kind: 'copy_failed' });
    expect(events.at(-1)).toBe('failure:copy_link:copy');
  });

  it('링크 확인이 실패하면 failure(link)로 끝나고 시트를 열지 않는다', async () => {
    const err = new Error('업로드 전');
    const { d, events } = deps({ link: vi.fn(async () => Promise.reject(err)) });
    await expect(runNativeShare(d)).resolves.toEqual({ kind: 'link_failed', error: err });
    expect(events).toEqual(['click', 'failure:native_share:link']);
    expect(d.share).not.toHaveBeenCalled();
  });
});
