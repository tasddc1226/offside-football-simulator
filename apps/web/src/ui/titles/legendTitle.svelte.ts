// 은퇴한 내 선수의 대표 칭호 바꾸기. 은퇴 때 굳은 대표 칭호를 그 선수가 받은 칭호 중에서 다시 고른다 — 이 기기
// 기록(ft_hof)에 남기고 서버에 다시 올린다(서버는 은퇴 때 올라온 상세 기록의 칭호 목록에 있는 것만 받는다).
import { loadHOF, saveKey } from '../../game/season.js';
import type { HofEntry } from '../../game/types.js';
import { toast, uploadRetirement } from '../helpers.js';
import { titleById } from '../../game/titles.js';

/** 커리어 id → 이번 접속에서 고른 대표 칭호(열려 있는 은퇴 화면이 바로 다시 그린다). */
const picked = $state<Record<string, string>>({});

/** 이 선수의 대표 칭호 — 이번 접속에서 고른 값이 먼저, 없으면 저장된 값. */
export const legendTitleOf = (careerId: string | undefined, saved: string | null | undefined) =>
  (careerId && picked[careerId]) || saved;

export function setLegendTitle(h: HofEntry, id: string) {
  if (!h.id) return;
  picked[h.id] = id;
  h.title = id;
  const hof = loadHOF();
  const saved = hof.find((x) => x.id === h.id);
  if (saved) saved.title = id;
  saveKey('ft_hof', hof);
  uploadRetirement(h.id, h);
  toast(`대표 칭호를 ‘${titleById(id)?.name ?? id}’(으)로 바꿨습니다.`);
}
