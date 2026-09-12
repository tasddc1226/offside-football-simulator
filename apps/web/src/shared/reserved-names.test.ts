// 정적 예약 목록이 콘텐츠 팩의 인물 토큰과 어긋나지 않는지 잡는 드리프트 가드.
import { loadContentPack, PACK_VERSIONS } from '@offside/content';
import { describe, expect, it } from 'vitest';
import { RESERVED_PLAYER_NAMES } from './reserved-names.js';

describe('RESERVED_PLAYER_NAMES', () => {
  it('모든 팩 버전의 manager·rival·captain·agent 토큰 이름을 빠짐없이 포함한다', () => {
    const reserved = new Set(RESERVED_PLAYER_NAMES);
    for (const version of PACK_VERSIONS) {
      const tokens = loadContentPack(version).narrativeTokens;
      const npcNames = [...tokens.manager, ...tokens.rival, ...tokens.captain, ...tokens.agent];
      const missing = npcNames.filter((name) => !reserved.has(name));
      expect(missing, `${version} 팩의 인물 토큰이 reserved-names.ts에 없다`).toEqual([]);
    }
  });
});
