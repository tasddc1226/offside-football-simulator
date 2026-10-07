// 이벤트 일본어 문구 — 정의 모듈의 이벤트 id → 문구(events-data.ts EventText).
import type { EventText } from '../../events-data';
import type { GameState } from '../../types';
import { milAbroad, sangmuChance } from '../../military';
import { tn } from '../names';

// military.ts의 모집 공고 문구를 일본어로 옮긴 것. 입영 연기 기한(만 28세)·낮은 합격률 기준(0.35)은 정의와 같다.
const MIL_AGE = 28;
const MIL_LOW = 0.35;

/** 앞으로 span년 안에 U-23 나이로 나갈 수 있는 특례 대회(military.ts milExemptHope와 같은 규칙). */
function hopeOf(s: GameState, span = 2): string[] {
  const out: string[] = [];
  for (let y = s.year; y <= s.year + span; y++) {
    const age = s.age + (y - s.year);
    if (age > 23) break;
    if (y % 4 === 2) out.push(`${y}年アジア大会`);
    if (y % 4 === 0 && s.nat?.qual[y] !== false) out.push(`${y}年オリンピック`);
  }
  return out;
}

const noticeText = (s: GameState): string => {
  const left = MIL_AGE - s.age,
    hope = hopeOf(s),
    abroad = milAbroad(s);
  return (
    `今年の金泉尚武(サンム)の選手募集が告知された。入隊延期の期限(満${MIL_AGE}歳)まであと${left}年。` +
    (abroad
      ? `海外組は国内の出場記録が足りず審査で不利だ。合格すれば${tn(s.club.name)}との契約を解除して帰国しなければならない。`
      : 'Kリーグ所属の選手は出場記録の審査で有利だ。') +
    (hope.length ? `${hope.join('・')}で兵役特例を得るチャンスもまだ残っている。` : '') +
    (sangmuChance(s) < MIL_LOW ? '合格の見込みは高くない。' : '')
  );
};

const apply: EventText['choices'][number] = {
  label: (s) => `志願書を出す(予想合格率${Math.round(sangmuChance(s) * 100)}%)`,
  ok: (s) =>
    (milAbroad(s)
      ? '志願書を提出した。去る準備をするあなたを、クラブは寂しがっている。結果はシーズン終了後に発表される。'
      : '志願書を提出した。結果はシーズン終了後に発表される。気持ちがすっと軽くなった。') +
    (hopeOf(s).length
      ? '尚武でも代表に選ばれる道はある。メダルを取れば体育要員に切り替わり、早期除隊になる。'
      : ''),
};

const defer: EventText['choices'][number] = {
  label: (s) =>
    hopeOf(s).length ? '入隊を延ばして兵役特例に挑む' : '入隊を延ばしてキャリアに集中する',
  ok: (s) =>
    hopeOf(s).length
      ? '代表メンバー入りしてメダルを狙う。失敗すれば入隊の期限に追われることになる。'
      : '今年は志願しない。入隊の期限が1年近づいた。',
};

/** 시즌 끝에 현역으로 입대하면 복무(다음 두 시즌) 중에 열려 못 나가는 특례 대회. */
const armyMissed = (s: GameState): string[] =>
  hopeOf(s).filter((h) => !h.startsWith(`${s.year}年`));

const army: EventText['choices'][number] = {
  label: 'シーズン後に先に現役で入隊する',
  ok: (s) =>
    '若いうちに早く済ませると決めた。シーズンが終われば入隊する。18か月の空白は覚悟の上だ。' +
    (armyMissed(s).length ? `服務中に開かれる${armyMissed(s).join('・')}には出られない。` : ''),
};

export const events_military: Record<string, EventText> = {
  'mil-notice': {
    title: '国軍体育部隊 選手募集',
    text: noticeText,
    choices: [apply, defer],
  },
  'mil-notice-low': {
    title: '国軍体育部隊 選手募集',
    text: noticeText,
    choices: [apply, defer, army],
  },
};
