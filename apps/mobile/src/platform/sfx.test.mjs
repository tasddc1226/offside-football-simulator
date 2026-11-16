// T-11-738 앱 효과음(assets/sfx/*.wav)이 공통 설계(@offside/app-core/sfx)로 만든 소리와 바이트까지 같은지 본다.
// 설계를 바꿨으면 SFX_WRITE=1 pnpm test:mobile-unit 으로 다시 만든다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SFX_IDS, encodeWav, renderSfx } from '@offside/app-core/sfx';

export const SFX_RATE = 32000;
const file = (id) => new URL(`../../assets/sfx/${id}.wav`, import.meta.url);

describe('app sfx assets', () => {
  it.each(SFX_IDS)('%s.wav matches the shared design', (id) => {
    const wav = encodeWav(renderSfx(id, SFX_RATE), SFX_RATE);
    if (process.env.SFX_WRITE === '1') writeFileSync(file(id), wav);
    expect(existsSync(file(id))).toBe(true);
    expect(Buffer.compare(readFileSync(file(id)), Buffer.from(wav))).toBe(0);
  });

  it('the player maps every sound to an asset', () => {
    const src = readFileSync(new URL('./sfx.ts', import.meta.url), 'utf8');
    for (const id of SFX_IDS) expect(src).toContain(`${id}: require('../../assets/sfx/${id}.wav')`);
  });
});
