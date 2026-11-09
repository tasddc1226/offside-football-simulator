// T-11-668 은퇴 커리어 링크 공유 흐름. ShareBar 에서 브라우저 의존(공유 시트 · 클립보드)을 받아 순서와 계측만 맡는다.
// 이벤트 의미는 @offside/app-core/shareMeasurement 주석이 정본이다.
import { shareErrorKind, type ShareOutcome } from '@offside/app-core/shareMeasurement';

export type ShareFlowDeps = {
  /** 확인이 끝나면 채워지는 공유 링크. 클릭 안에서 이미 시작돼 있어야 한다. */
  link: Promise<string>;
  /** navigator.share. 없으면 바로 복사한다. */
  share?: ((data: ShareData) => Promise<void>) | undefined;
  canShare?: ((data: ShareData) => boolean) | undefined;
  shareData: (url: string) => ShareData;
  /** 클립보드 쓰기를 바로 시작한다(Safari 는 제스처가 끝난 뒤 쓰기를 막는다). link 가 채워지면 그 값을 쓴다. */
  writeClipboard: (link: Promise<string>) => Promise<void>;
  /** 링크가 확인되면 한 번 부른다(화면의 링크 칸). */
  onLink: (url: string) => void;
  track: (o: ShareOutcome) => void;
};

export type ShareFlowResult =
  | { kind: 'native' }
  | { kind: 'cancel' }
  | { kind: 'copied' }
  | { kind: 'copy_failed' }
  | { kind: 'link_failed'; error: unknown };

/** 네이티브 공유 시트 우선, 없거나 취소가 아닌 오류면 복사로 넘어간다. 시트를 닫으면(AbortError) 조용히 끝낸다. */
export async function runShareFlow(d: ShareFlowDeps): Promise<ShareFlowResult> {
  if (d.share) {
    let url: string;
    try {
      url = await d.link;
    } catch (error) {
      d.track({
        kind: 'failure',
        method: 'native_share',
        stage: 'link',
        error: shareErrorKind(error),
      });
      return { kind: 'link_failed', error };
    }
    d.onLink(url);
    const data = d.shareData(url);
    // canShare 가 false 면 시트를 열 수 없으니 preview 없이 복사로 간다(실패로 세지 않는다).
    if (d.canShare?.(data) !== false) {
      d.track({ kind: 'preview' });
      try {
        await d.share(data);
        d.track({ kind: 'native_success' });
        return { kind: 'native' };
      } catch (error) {
        if ((error as { name?: unknown } | null)?.name === 'AbortError') {
          d.track({ kind: 'cancel' });
          return { kind: 'cancel' };
        }
        d.track({
          kind: 'failure',
          method: 'native_share',
          stage: 'native',
          error: shareErrorKind(error),
        });
      }
    }
  }
  return copyFlow(d);
}

async function copyFlow(d: ShareFlowDeps): Promise<ShareFlowResult> {
  let copied: Promise<void>;
  try {
    copied = d.writeClipboard(d.link);
  } catch (error) {
    copied = Promise.reject(error);
  }
  // 링크 확인이 먼저 실패하면 이 결과는 읽지 않는다. 처리되지 않은 rejection 으로 남지 않게 미리 받아 둔다.
  copied.catch(() => {});
  let url: string;
  try {
    url = await d.link;
  } catch (error) {
    d.track({ kind: 'failure', method: 'copy_link', stage: 'link', error: shareErrorKind(error) });
    return { kind: 'link_failed', error };
  }
  d.onLink(url);
  try {
    await copied;
    d.track({ kind: 'copy_success' });
    return { kind: 'copied' };
  } catch (error) {
    d.track({ kind: 'failure', method: 'copy_link', stage: 'copy', error: shareErrorKind(error) });
    return { kind: 'copy_failed' };
  }
}
