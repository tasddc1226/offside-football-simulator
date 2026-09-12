import { render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useExpandDisclosuresOnHash } from './expand-disclosures-on-hash.js';

afterEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

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
    window.location.hash = '#settings-account';

    renderHook(() => useExpandDisclosuresOnHash());

    expect(document.querySelector('details')).toHaveAttribute('open');
  });

  it('opens ancestor details that contain the hash target (e.g. #settings-play nested inside a Disclosure)', () => {
    render(
      <details>
        <summary>시뮬레이션</summary>
        <div id="settings-play">본문</div>
      </details>,
    );
    window.location.hash = '#settings-play';

    renderHook(() => useExpandDisclosuresOnHash());

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

    renderHook(() => useExpandDisclosuresOnHash());

    expect(document.querySelector('details')).not.toHaveAttribute('open');
  });
});
