import { render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useExpandDisclosuresOnHash } from './expand-disclosures-on-hash.js';

afterEach(() => {
  document.body.innerHTML = '';
});

// T-7-039: 이 훅은 이제 실제 주소창 hash가 아니라 호출부(settings.tsx)가 라우터 위치에서 읽어
// 넘기는 hash 문자열을 인자로 받는다.
describe('useExpandDisclosuresOnHash', () => {
  it('opens every details inside the element the current hash targets', () => {
    render(
      <section id="settings-account">
        <details>
          <summary>프로필 복구</summary>
          <p>폼</p>
        </details>
      </section>,
    );

    renderHook(() => useExpandDisclosuresOnHash('#settings-account'));

    expect(document.querySelector('details')).toHaveAttribute('open');
  });

  it('opens ancestor details that contain the hash target (e.g. #settings-play nested inside a Disclosure)', () => {
    render(
      <details>
        <summary>시뮬레이션</summary>
        <div id="settings-play">본문</div>
      </details>,
    );

    renderHook(() => useExpandDisclosuresOnHash('#settings-play'));

    expect(document.querySelector('details')).toHaveAttribute('open');
  });

  it('leaves details untouched when there is no hash', () => {
    render(
      <section id="settings-account">
        <details>
          <summary>프로필 복구</summary>
          <p>폼</p>
        </details>
      </section>,
    );

    renderHook(() => useExpandDisclosuresOnHash(''));

    expect(document.querySelector('details')).not.toHaveAttribute('open');
  });
});
