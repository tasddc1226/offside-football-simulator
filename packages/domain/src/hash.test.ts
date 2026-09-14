import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex, setSha256Provider } from './hash.js';

describe('sha256Hex — FIPS 180-4 테스트 벡터', () => {
  it('빈 문자열', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('"abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('448비트(56바이트) 메시지 — 패딩이 한 블록을 넘지 않는 경계', () => {
    const message = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';
    expect(message.length).toBe(56);
    expect(sha256Hex(message)).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('896비트(112바이트) 메시지 — 두 블록에 걸치는 경계', () => {
    const message =
      'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu';
    expect(message.length).toBe(112);
    expect(sha256Hex(message)).toBe('cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1');
  });

  it('한글·이모지가 섞인 UTF-8 입력', () => {
    expect(sha256Hex('한글💡')).toBe('2125b851dacce39668f37a34558a553c34b4d3d9174423fa099333c784d3565a');
  });
});

describe('setSha256Provider — 주입 경로', () => {
  afterEach(() => {
    setSha256Provider(null);
  });

  it('provider를 설치하면 그 결과를 돌려주고, null로 되돌리면 순수 구현으로 복귀한다', () => {
    // 스파이 함수는 순수 구현을 감싸기만 한다(Node API 사용 금지) — provider 경로가 실제로
    // 불렸는지, 그리고 반환값이 provider 결과 그대로인지 확인한다.
    let calls = 0;
    setSha256Provider((input) => {
      calls += 1;
      return `spy:${input.length}`;
    });
    expect(sha256Hex('abc')).toBe('spy:3');
    expect(calls).toBe(1);

    setSha256Provider(null);
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('provider를 켰다 끄더라도 순수 구현의 기존 테스트 벡터 결과는 변하지 않는다', () => {
    // 스파이 provider는 설치 전(순수 경로)에 계산해 둔 값을 그대로 돌려준다 — Node API 없이도
    // provider 경로를 실제로 거치면서 값이 유지되는지 확인한다.
    const vectors = ['', 'abc', '한글💡'];
    const pureResults = vectors.map((v) => sha256Hex(v));
    setSha256Provider((input) => pureResults[vectors.indexOf(input)]!);
    for (let i = 0; i < vectors.length; i += 1) expect(sha256Hex(vectors[i]!)).toBe(pureResults[i]);

    setSha256Provider(null);
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('한글💡')).toBe('2125b851dacce39668f37a34558a553c34b4d3d9174423fa099333c784d3565a');
  });
});
