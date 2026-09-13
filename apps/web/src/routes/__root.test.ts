// UX-013 후속: 라우트 전환 스크롤 리셋(main#game-content.scrollTop = 0)이 딥링크(#settings-play
// 같은 해시가 가리키는 요소가 실제로 존재하는 전환)와 경합하지 않도록 결정 로직만 순수 함수로 뽑아
// 두었다 — 라우터를 목킹하지 않고도 네 갈래를 전부 검증할 수 있다.
import { describe, expect, it } from 'vitest';
import { shouldResetScrollOnRouteChange } from './__root.js';

describe('shouldResetScrollOnRouteChange', () => {
  it('pathname 변경 여부·해시 대상 존재 여부의 네 조합 중 딥링크(pathname 변경 + 존재하는 해시 대상)만 리셋을 건너뛴다', () => {
    // pathname이 그대로면(같은 경로 안 해시 변경 포함) 해시 유무와 무관하게 절대 리셋하지 않는다.
    expect(
      shouldResetScrollOnRouteChange({ pathChanged: false, hash: '', hashTargetExists: false }),
    ).toBe(false);
    expect(
      shouldResetScrollOnRouteChange({
        pathChanged: false,
        hash: 'settings-play',
        hashTargetExists: true,
      }),
    ).toBe(false);
    // pathname이 바뀌고 해시가 없으면 새 화면을 맨 위에서 시작하도록 리셋한다.
    expect(
      shouldResetScrollOnRouteChange({ pathChanged: true, hash: '', hashTargetExists: false }),
    ).toBe(true);
    // pathname이 바뀌었지만 해시 대상이 없으면(끊어진 링크) 보통 전환처럼 리셋한다.
    expect(
      shouldResetScrollOnRouteChange({
        pathChanged: true,
        hash: 'missing-section',
        hashTargetExists: false,
      }),
    ).toBe(true);
    // pathname이 바뀌었고 해시 대상이 실제로 있으면(예: /settings#settings-play) 딥링크 스크롤이
    // 이기도록 리셋을 건너뛴다 — 이게 이번 후속의 근본 수정 지점이다.
    expect(
      shouldResetScrollOnRouteChange({
        pathChanged: true,
        hash: 'settings-play',
        hashTargetExists: true,
      }),
    ).toBe(false);
  });
});
