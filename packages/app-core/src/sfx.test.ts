import { describe, expect, it } from 'vitest';
import { SFX_IDS, createSfxGate, encodeWav, renderSfx, sfxSeconds } from './sfx';
import { boostSfx, enhanceSfx } from './sfxKind';

describe('sfx', () => {
  it('renders every sound deterministically within range', () => {
    for (const id of SFX_IDS) {
      const a = renderSfx(id, 22050);
      const b = renderSfx(id, 22050);
      expect(a).toEqual(b);
      expect(a.length).toBe(Math.ceil((sfxSeconds(id) + 0.02) * 22050));
      let peak = 0;
      for (const s of a) peak = Math.max(peak, Math.abs(s));
      // 들리되 클릭음(0.12)보다 크게 튀지 않는다.
      expect(peak).toBeGreaterThan(0.01);
      expect(peak).toBeLessThan(0.3);
    }
  });

  it('keeps sounds short (only the retirement whistle runs long)', () => {
    for (const id of SFX_IDS)
      expect(sfxSeconds(id)).toBeLessThanOrEqual(id === 'fulltime' ? 1.6 : 0.85);
  });

  it('encodes a 16-bit mono wav', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 22050);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(v.getUint32(24, true)).toBe(22050);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32767);
  });

  it('drops the same sound repeated within the gap', () => {
    const gate = createSfxGate(120);
    expect(gate('good', 0)).toBe(true);
    expect(gate('good', 50)).toBe(false);
    expect(gate('bad', 60)).toBe(true);
    expect(gate('good', 130)).toBe(true);
  });

  it('maps results to sounds', () => {
    expect(enhanceSfx('success')).toBe('good');
    expect(enhanceSfx('keep')).toBe('keep');
    expect(enhanceSfx('down')).toBe('bad');
    expect(boostSfx({ ok: true, great: true })).toBe('great');
    expect(boostSfx({ ok: true })).toBe('good');
    expect(boostSfx({ ok: false })).toBe('bad');
  });
});
