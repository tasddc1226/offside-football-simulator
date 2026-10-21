// T-11-432 이벤트 선택지 득실 칩. 생성된 표(@offside/game/event-peek-data)만 읽어 1~2개를 고른다 —
// 효과를 미리 돌려 보지 않으므로 게임 결과·RNG·세이브와 무관하다. 웹 · 앱이 같이 쓴다.
import { eventPeek } from '@offside/game/event-peek-data';
import { peekIsLoss, type ChoicePeek, type PeekKey } from '@offside/game/event-peek';
import { STORIES } from '@offside/game/story';
import { tn } from '@offside/game/i18n/names';
import { gameActionsText as L } from './i18n/ko/gameActions';

export type PeekChip = { text: string; tone: 'up' | 'down' | 'risk' };
/** sure: 판정 없음, safe: 안전(가끔 대가), roll: 확률·미니게임 판정. */
export type PeekKind = 'sure' | 'safe' | 'roll';

const STAT_LABEL = () =>
  ({
    cond: L.peekCond,
    morale: L.peekMorale,
    fame: L.peekFame,
    trust: L.peekTrust,
    money: L.peekMoney,
    attr: L.peekAttr,
    pot: L.peekPot,
  }) as Record<string, string>;

/** 득실 키 하나를 칩 글자로. 모르는 키는 null(데이터가 앞서 나가도 화면은 깨지지 않게). */
export function peekText(k: PeekKey): string | null {
  if (k === 'out') return L.peekOut;
  if (k.startsWith('story:')) {
    const st = STORIES[k.slice(6)];
    return st ? L.peekStory({ name: tn(st.name) }) : null;
  }
  const label = STAT_LABEL()[k.slice(0, -1)];
  if (!label) return null;
  return k.endsWith('+') ? L.peekUp({ label }) : L.peekDown({ label });
}

const chip = (k: PeekKey): PeekChip | null => {
  const text = peekText(k);
  return text ? { text, tone: peekIsLoss(k) ? 'down' : 'up' } : null;
};
const first = (keys: readonly PeekKey[] | undefined, loss: boolean) =>
  keys?.find((k) => peekIsLoss(k) === loss && peekText(k));

/** 선택지 하나에 보일 칩(확정 득실 최대 2개, 안전한 선택은 '가끔 대가'를 더해 3개). 손해를 먼저 고른다(숨은 대가가 지적의 핵심이었다). */
export function choiceChips(peek: ChoicePeek | undefined, kind: PeekKind): PeekChip[] {
  const out: PeekChip[] = [];
  const used = new Set<PeekKey>();
  const push = (k: PeekKey | undefined) => {
    const c = k && !used.has(k) && chip(k);
    if (!c || out.length >= 2) return;
    used.add(k);
    out.push(c);
  };
  if (kind === 'roll') {
    // 성공하면 얻는 것 하나, 실패하면 잃는 것 하나.
    push(first(peek?.ok, false));
    const loss = first(peek?.fail, true);
    const t = loss && peekText(loss);
    if (t) out.push({ text: L.peekFail({ chip: t }), tone: 'down' });
    return out;
  }
  push(first(peek?.ok, true));
  push(first(peek?.ok, false));
  for (const k of peek?.ok ?? []) push(k);
  // 안전한 선택은 가끔 붙는 대가를 덧붙인다(무작위라 항목을 미리 말할 수 없다). 확정 득실 2개 + 이 칩까지 최대 3개.
  if (kind === 'safe') out.push({ text: L.peekSafeCost, tone: 'risk' });
  return out;
}

export const choiceChipsFor = (evId: string, i: number, kind: PeekKind) =>
  choiceChips(eventPeek(evId, i), kind);
