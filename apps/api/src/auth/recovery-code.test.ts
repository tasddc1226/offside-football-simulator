import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../db/hash.js';
import {
  generateRecoveryCode,
  normalizeRecoveryCode,
  pickAlphabetChar,
  type RandomByteSource,
} from './recovery-code.js';

describe('generateRecoveryCode', () => {
  it('OFS-XXXX-XXXX-XXXX 형식, 12자리 본문', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^OFS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const body = code.replace('OFS-', '').replace(/-/g, '');
    expect(body).toHaveLength(12);
  });

  it('금지 문자(I L O U 0 1)를 쓰지 않는다(고정 접두 OFS의 O는 대상이 아니다)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRecoveryCode();
      const body = code.replace(/^OFS-/, '');
      expect(body).not.toMatch(/[ILOU01]/);
    }
  });
});

describe('normalizeRecoveryCode', () => {
  it('소문자·공백·하이픈·ofs 접두 변형 4종이 같은 해시를 낸다', async () => {
    const canonical = 'OFS-AB3D-9F2K-7Q4T';
    const variants = [
      'OFS-AB3D-9F2K-7Q4T',
      'ofs ab3d 9f2k 7q4t',
      'OFSAB3D9F2K7Q4T',
      'AB3D-9F2K-7Q4T',
    ];

    const canonicalHash = await sha256Hex(normalizeRecoveryCode(canonical));
    for (const variant of variants) {
      expect(await sha256Hex(normalizeRecoveryCode(variant))).toBe(canonicalHash);
    }
  });

  it('정규화 결과는 12자다', () => {
    expect(normalizeRecoveryCode('OFS-AB3D-9F2K-7Q4T')).toBe('AB3D9F2K7Q4T');
  });
});

describe('pickAlphabetChar rejection sampling', () => {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

  function stubSource(bytes: number[]): RandomByteSource {
    let index = 0;
    return (length: number) => {
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        out[i] = bytes[index]!;
        index++;
      }
      return out;
    };
  }

  it('편향 경계(240) 이상 바이트는 버리고 다시 뽑는다', () => {
    // 30자 알파벳 → ceiling = 256 - (256 % 30) = 240. 240~255는 버려야 한다.
    const result = pickAlphabetChar(stubSource([240, 254, 255, 0]));
    expect(result).toBe(ALPHABET[0]);
  });

  it('ceiling 바로 아래 바이트(239)는 그대로 쓴다', () => {
    // 239 % 30 = 29 → 알파벳의 마지막 글자.
    const result = pickAlphabetChar(stubSource([239]));
    expect(result).toBe(ALPHABET[29]);
  });

  it('0은 알파벳의 첫 글자다', () => {
    expect(pickAlphabetChar(stubSource([0]))).toBe(ALPHABET[0]);
  });
});
