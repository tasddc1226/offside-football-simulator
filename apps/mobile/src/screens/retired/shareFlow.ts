// T-11-676 앱 은퇴 커리어 공유 흐름(웹 ui/shareFlow.ts와 같은 계측 계약). ShareBar가 RN Share · 클립보드를 넘기고, 여기서는
// 순서와 계측만 맡는다. 이벤트 의미는 @offside/app-core/shareMeasurement 주석이 정본이다.
// RN Share.share는 iOS에서 시트를 닫으면 dismissedAction으로 끝난다. Android는 고른 대상과 상관없이 sharedAction으로 끝나서
// Android의 native_success는 '시트를 열었다'에 가깝다(취소를 구분하지 못한다).
import { shareErrorKind, type ShareOutcome } from '@offside/app-core/shareMeasurement';

export type NativeShareDeps = {
  /** 공유 링크(한 번 확인한 링크는 다시 묻지 않는다). 실패하면 공유를 시작하지 못한다. */
  link: () => Promise<string>;
  /** RN Share.share. 'dismissed'면 사용자가 시트를 닫은 것. */
  share: (url: string) => Promise<'shared' | 'dismissed'>;
  /** 시트를 못 열면 클립보드로 복사한다. */
  copy: (url: string) => Promise<void>;
  track: (o: ShareOutcome) => void;
};

export type NativeShareResult =
  | { kind: 'native' }
  | { kind: 'cancel' }
  | { kind: 'copied' }
  | { kind: 'copy_failed' }
  | { kind: 'link_failed'; error: unknown };

/** 버튼을 한 번 누를 때마다 부른다. click으로 시작해 결과 하나(시트 실패 뒤 복사면 failure + 복사 결과)로 끝난다. */
export async function runNativeShare(d: NativeShareDeps): Promise<NativeShareResult> {
  d.track({ kind: 'click' });
  let url: string;
  try {
    url = await d.link();
  } catch (error) {
    d.track({
      kind: 'failure',
      method: 'native_share',
      stage: 'link',
      error: shareErrorKind(error),
    });
    return { kind: 'link_failed', error };
  }
  d.track({ kind: 'preview' });
  try {
    const action = await d.share(url);
    if (action === 'dismissed') {
      d.track({ kind: 'cancel' });
      return { kind: 'cancel' };
    }
    d.track({ kind: 'native_success' });
    return { kind: 'native' };
  } catch (error) {
    d.track({
      kind: 'failure',
      method: 'native_share',
      stage: 'native',
      error: shareErrorKind(error),
    });
  }
  try {
    await d.copy(url);
    d.track({ kind: 'copy_success' });
    return { kind: 'copied' };
  } catch (error) {
    d.track({ kind: 'failure', method: 'copy_link', stage: 'copy', error: shareErrorKind(error) });
    return { kind: 'copy_failed' };
  }
}
