import { expect, it } from 'vitest';
import fixture from './__fixtures__/save-fw26.json';
import { checkTitles } from './titles.js';
import { eventById } from './events-data.js';
import './event-registry.js';
import { resolveChoice, rollEvent } from './event-runner.js';
import { loadSave } from './save.js';
import { turnNo } from './story.js';
import type { GameState } from './types.js';

it.each([
  [0, 'shirt', 0, 'st_fan_cheer'],
  [1, 'ball', 1, 'st_fan_tip'],
] as const)(
  'remembers gift %i across seasons and reload, and records the reply',
  (choice, gift, reply, title) => {
    const s = loadSave(structuredClone(fixture) as unknown as GameState)!.G;
    s.phase = 2;
    s.chains = [];
    const start = turnNo(s);
    resolveChoice(s, 'kid-autograph', choice);
    const letter = 'fan-letter-' + gift;
    expect(s.chains).toEqual([{ id: letter, at: start + 3, until: start + 9 }]);
    resolveChoice(s, 'kid-autograph', 1 - choice);
    expect(s.chains.map((c) => c.id)).toEqual([letter]);
    const restored = loadSave(JSON.parse(JSON.stringify(s)))!.G;
    restored.year++;
    restored.phase = 1;
    expect(rollEvent(restored)).not.toBe(letter);
    restored.phase = 2;
    expect(rollEvent(restored)).toBe(letter);
    expect(eventById(letter)!.text(restored)).toContain(gift === 'shirt' ? '유니폼' : '축구공');
    resolveChoice(restored, letter, reply);
    expect(restored.storyLog?.filter((x) => x.key === 'fanLetter')).toHaveLength(1);
    expect(checkTitles(restored).map((t) => t.id)).toContain(title);
    resolveChoice(restored, 'kid-autograph', choice);
    expect(restored.chains?.some((c) => c.id.startsWith('fan-letter-'))).toBe(false);
  },
);
