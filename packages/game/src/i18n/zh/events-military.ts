// 이벤트 중국어(번체) 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';
import type { GameState } from '../../types';
import { milAbroad, sangmuChance } from '../../military';
import { tn } from '../names';

// military.ts의 모집 공고 문구를 중국어로 옮긴 것. 입영 연기 기한(만 28세)·낮은 합격률 기준(0.35)은 정의와 같다.
const MIL_AGE = 28;
const MIL_LOW = 0.35;

/** 앞으로 span년 안에 U-23 나이로 나갈 수 있는 특례 대회(military.ts milExemptHope와 같은 규칙). */
function hopeOf(s: GameState, span = 2): string[] {
  const out: string[] = [];
  for (let y = s.year; y <= s.year + span; y++) {
    const age = s.age + (y - s.year);
    if (age > 23) break;
    if (y % 4 === 2) out.push(`${y}年亞運`);
    if (y % 4 === 0 && s.nat?.qual[y] !== false) out.push(`${y}年奧運`);
  }
  return out;
}

const noticeText = (s: GameState): string => {
  const left = MIL_AGE - s.age,
    hope = hopeOf(s),
    abroad = milAbroad(s);
  return (
    `今年金泉尚武（國軍體育隊）的球員招募公告出爐了。距離延後入伍的期限（滿${MIL_AGE}歲）還剩${left}年。` +
    (abroad
      ? `旅外球員國內出賽紀錄不足，審查時較吃虧。一旦錄取，就得和${tn(s.club.name)}解約回國。`
      : 'K聯賽球員在出賽紀錄審查上較有優勢。') +
    (hope.length ? `在${hope.join('、')}拿到兵役豁免的機會也還在。` : '') +
    (sangmuChance(s) < MIL_LOW ? '錄取的希望並不大。' : '')
  );
};

const apply: EventText['choices'][number] = {
  label: (s) => `遞交申請書（預估錄取率${Math.round(sangmuChance(s) * 100)}%）`,
  ok: (s) =>
    (milAbroad(s)
      ? '申請書交出去了。俱樂部對準備離開的你依依不捨。結果將在賽季結束後公布。'
      : '申請書交出去了。結果將在賽季結束後公布。心裡一下子輕鬆不少。') +
    (hopeOf(s).length ? '在尚武一樣有機會入選國家隊。若能奪牌，就能轉為體育役提前退伍。' : ''),
};

const defer: EventText['choices'][number] = {
  label: (s) => (hopeOf(s).length ? '延後入伍，挑戰兵役豁免' : '延後入伍，專心衝刺生涯'),
  ok: (s) =>
    hopeOf(s).length
      ? '要擠進國家隊名單、拚一面獎牌。失敗的話，就得被入伍期限追著跑。'
      : '今年不申請。入伍期限又近了一年。',
};

/** 시즌 끝에 현역으로 입대하면 복무(다음 두 시즌) 중에 열려 못 나가는 특례 대회. */
const armyMissed = (s: GameState): string[] =>
  hopeOf(s).filter((h) => !h.startsWith(`${s.year}年`));

const army: EventText['choices'][number] = {
  label: '賽季結束後先以現役入伍',
  ok: (s) =>
    '決定趁年輕早點服完。賽季一結束就入伍，十八個月的空白早有覺悟。' +
    (armyMissed(s).length ? `服役期間舉行的${armyMissed(s).join('、')}將無法參加。` : ''),
};

export const events_military: Record<string, EventText> = {
  'mil-notice': {
    title: '國軍體育隊 球員招募',
    text: noticeText,
    choices: [apply, defer],
  },
  'mil-notice-low': {
    title: '國軍體育隊 球員招募',
    text: noticeText,
    choices: [apply, defer, army],
  },
};
