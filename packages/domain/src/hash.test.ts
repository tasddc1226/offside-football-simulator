import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash.js';

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
