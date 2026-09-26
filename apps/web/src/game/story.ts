import { LAST_PHASE } from './data.js';
import { EVENTS } from './events-data.js';
import type { GameState } from './types.js';
import { log } from './stats.js';

// ───────── 스토리/체인 헬퍼 (원본 stories.js) ─────────
export interface StoryDef {
  name: string;
  total: number;
}
export const STORIES: Record<string, StoryDef> = {
  rival: { name: '평생의 라이벌', total: 3 },
  rehab: { name: '재활의 시간', total: 3 },
  scandal: { name: '스캔들', total: 3 },
  europe: { name: '유럽의 꿈', total: 3 },
  mentor: { name: '감독과의 인연', total: 3 },
};
export function turnNo(s: GameState): number {
  return (s.year - 2026) * (LAST_PHASE + 1) + Math.min(s.phase, LAST_PHASE);
}
export function schedule(s: GameState, id: string, delay: number, window = 6) {
  s.chains = (s.chains || []).filter((c) => c.id !== id);
  const at = turnNo(s) + delay;
  s.chains.push({ id, at, until: at + window });
}
export function storyActive(s: GameState, key: string): boolean {
  return !!(s.story && s.story[key] && !s.story[key]!.done);
}
export function startStory(s: GameState, key: string, data: Record<string, unknown> = {}) {
  s.story = s.story || {};
  s.story[key] = { stage: 1, done: false, ...data };
}
export function advanceStory(s: GameState, key: string, stage: number) {
  if (storyActive(s, key)) s.story[key]!.stage = stage;
}
export function endStory(s: GameState, key: string, ending: string) {
  if (!storyActive(s, key)) return;
  const st = s.story[key]!;
  st.done = true;
  st.ending = ending;
  s.storyLog = s.storyLog || [];
  s.storyLog.push({ year: s.year, key, name: STORIES[key]!.name, ending });
  s.chains = (s.chains || []).filter((c) => {
    const e = EVENTS.find((x) => x.id === c.id);
    return !e || e.story !== key;
  });
  log(s, `[스토리 완결] ${STORIES[key]!.name} · ${ending}`, 'big', Math.max(0, s.phase - 1));
}

