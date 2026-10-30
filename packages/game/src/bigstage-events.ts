// ───────── 축구계 큰 무대 (T-11-543) ─────────
// 실제 축구 달력의 큰 장면들. 월드컵이 열리는 해의 명단 경쟁은 3단계 스토리(월드컵 가는 길)로 잇고, 나머지는 한 장면이다.
// 대회 결과(월드컵 · 대륙컵 · 올림픽 · 대륙 대회)는 national.ts · comps.ts가 정하고, 여기서는 그 전후의 선택만 다룬다
// (와일드카드 제안의 답만 national.ts squadRole이 읽는다). 효과의 크기는 비슷한 기존 이벤트(realevents.ts)에 맞췄다.
// 문구는 i18n/ko/gBigStage.ts.
import { clamp, ri } from './rng.js';
import {
  addStat,
  addAttr,
  adFee,
  bestKey,
  endStory,
  advanceStory,
  fmtMoney,
  isPro,
  leagueOf,
  schedule,
  startStory,
  storyActive,
} from './engine.js';
import { ovr } from './attributes.js';
import { callupScore, contCupConf, natRefusing, NT_THRESHOLD, oaFlag } from './national.js';
import { TOP_G } from './comps.js';
import { isKorean, nationOf } from './nation.js';
import { gBigStageText as L } from './i18n/ko/gBigStage.js';
import type { Confed } from './nation.js';
import type { EventDef, GameState, NatTour, SeasonComp } from './types.js';

/** 월드컵에서 이 단계까지 가면 '월드컵의 주인공'(골 2개 이상도). */
const DEEP = new Set(['8강', '4강', '준우승', '우승']); // i18n-ignore 저장값(NatTour.stage)
/** 대표팀 대회 우승 단계. */
const WON = new Set(['우승', '금메달']); // i18n-ignore 저장값(NatTour.stage)
const RUNNER_UP = '준우승'; // i18n-ignore 저장값(SeasonComp.stage)
/** 스토리가 끝나지 못하고 지나가면(발표 직전 부상 등) 이 결말이다. titles.ts STORY_ENDINGS에도 있다. */
const WC_NEXT = '다음 월드컵을 향해'; // i18n-ignore 저장값(스토리 결말 · 칭호 키)

/** 리그가 속한 연맹(장거리 비행 판정). 없는 리그는 유럽으로 본다. */
const LEAGUE_CONF: Record<string, Confed> = {
  k3: 'AFC',
  k2: 'AFC',
  k1: 'AFC',
  csl: 'AFC',
  j1: 'AFC',
  spl: 'AFC',
  mls: 'CONCACAF',
  bra: 'CONMEBOL',
};
const leagueConf = (s: GameState): Confed => LEAGUE_CONF[s.leagueId] ?? 'UEFA';

/** 지난해(대회는 시즌 결산에서 치른다) 대표팀 대회 기록. */
const lastTours = (s: GameState): NatTour[] =>
  (s.nat?.tours ?? []).filter((t) => t.year === s.year - 1);
/** 지난해 월드컵 기록. */
export const lastWc = (s: GameState): NatTour | undefined =>
  lastTours(s).find((t) => t.name.includes('FIFA'));
const isWcYear = (s: GameState) => s.year % 4 === 2 && s.nat?.qual?.[s.year] !== false;
const natOpen = (s: GameState) => !!s.nat && !s.nat.retired && !natRefusing(s);
export const contComp = (s: GameState): SeasonComp | undefined =>
  (s.season.comps ?? []).find((c) => c.type === 'cont');
/** 와일드카드를 물을 대회 — 올림픽 해(본선 진출)면 올림픽, 아시아 연맹의 아시안게임 해면 아시안게임. */
export function oaKey(s: GameState): 'olympic' | 'ag' | null {
  if (s.year % 4 === 0 && s.nat?.qual?.[s.year] !== false) return 'olympic';
  if (s.year % 4 === 2 && nationOf(s).conf === 'AFC') return 'ag';
  return null;
}
/** 지금 구단에서 연달아 뛴 지난 시즌 수(임대 시즌에서 끊는다). */
export function clubSeasons(s: GameState): number {
  let n = 0;
  for (let i = s.career.length - 1; i >= 0; i--) {
    const c = s.career[i]!;
    if (c.clubId !== s.club.id || c.loan || c.pro === false) break;
    n++;
  }
  return n;
}
/** 지난 시즌 발롱도르 순위(30인 후보가 아니면 30). */
export const ballonRank = (s: GameState): number =>
  (s.ballon ?? []).find((b) => b.year === s.year - 1)?.rank ?? 30;
/** 월드컵 가는 길 3단계 첫 문장 — 지난여름 월드컵에서 어디까지 갔는지. */
export function wcBackText(s: GameState, t: typeof L = L): string {
  const w = lastWc(s);
  return w?.inSquad && DEEP.has(w.stage)
    ? t.wc3TextHero({ stage: w.stage })
    : w?.inSquad
      ? t.wc3TextSquad
      : t.wc3TextMissed;
}
/** 와일드카드 제안 문구 — 대한민국 국적이고 아직 병역을 마치지 않았으면 병역 특례 문장을 붙인다. */
export function oaText(s: GameState, t: typeof L = L): string {
  const olympic = oaKey(s) === 'olympic';
  const mil = isKorean(s) && !(s.mil && (s.mil.exempt || s.mil.served));
  return mil ? `${t.oaText({ olympic })} ${t.oaMilText({ olympic })}` : t.oaText({ olympic });
}
/** 대륙 대회 결승 패배 · 대표팀 우승 같은 1회성 장면이 한 해에 두 번 나오지 않게. */
const once = (s: GameState, k: string) => !s.flags[k + s.year];
const mark = (s: GameState, k: string) => (s.flags[k + s.year] = 1);

/** 월드컵 가는 길의 결말 — 지난여름 월드컵 결과로 정한다. */
function endWc(s: GameState) {
  const t = lastWc(s);
  if (t?.inSquad && (DEEP.has(t.stage) || t.goals >= 2))
    endStory(s, 'worldcup', '월드컵의 주인공'); // i18n-ignore 저장값(스토리 결말 · 칭호 키)
  else if (t?.inSquad)
    endStory(s, 'worldcup', '꿈의 무대를 밟다'); // i18n-ignore 저장값(스토리 결말 · 칭호 키)
  else endStory(s, 'worldcup', '다음 월드컵을 향해'); // i18n-ignore 저장값(스토리 결말 · 칭호 키)
}
export const testiFee = (s: GameState) => Math.round(adFee(s) / 10) * 10;

export const BIGSTAGE_EVENTS: EventDef[] = [
  // ── 월드컵 가는 길 1: 월드컵 해 전반기, 명단 경쟁이 시작된다 ──
  {
    id: 'wc-road-1',
    story: 'worldcup',
    stage: 1,
    get title() {
      return L.wc1Title;
    },
    w: 6,
    cond: (s) =>
      isPro(s) &&
      s.phase === 1 &&
      isWcYear(s) &&
      !s.story?.worldcup &&
      natOpen(s) &&
      s.age <= 34 &&
      callupScore(s) >= NT_THRESHOLD - 4,
    text: (s) => L.wc1Text({ year: s.year }),
    choices: [
      {
        label: () => L.wc1PushLabel,
        p: (s) =>
          clamp(0.45 + (s.cond - 60) / 150 + (ovr(s) - leagueOf(s.leagueId).avg) * 0.02, 0.2, 0.8),
        ok: {
          text: () => L.wc1PushOk,
          fx: (s) => {
            startStory(s, 'worldcup');
            addAttr(s, bestKey(s), 1);
            addStat(s, 'fame', 4);
            addStat(s, 'morale', 4);
            addStat(s, 'cond', -8);
            schedule(s, 'wc-road-2', 0, 0);
          },
        },
        fail: {
          text: () => L.wc1PushFail,
          fx: (s) => {
            startStory(s, 'worldcup');
            s.injury = Math.max(s.injury, ri(1, 3));
            addStat(s, 'cond', -8);
            addStat(s, 'morale', -4);
            schedule(s, 'wc-road-2', 0, 0);
          },
        },
      },
      {
        label: () => L.wc1PaceLabel,
        ok: {
          text: () => L.wc1PaceOk,
          fx: (s) => {
            startStory(s, 'worldcup');
            addStat(s, 'trust', 1);
            addStat(s, 'cond', 6);
            schedule(s, 'wc-road-2', 0, 0);
          },
        },
      },
    ],
  },
  // 선택은 구간을 마친 뒤(playPhase가 phase를 올린 뒤)에 고르므로 지연 0이 바로 다음 구간(후반기)이다. 창 0이라 그 구간에
  // 오지 못하면(부상) 바로 지나간다. 후반기 뒤 선택은 phase 3이라 turnNo가 후반기와 같아 지연 1이 다음 시즌 프리시즌이다.
  // ── 2: 후반기, 명단 발표 직전 경기. 여기서 다치면 시즌 결산의 월드컵에 못 간다 ──
  {
    id: 'wc-road-2',
    story: 'worldcup',
    stage: 2,
    chain: true,
    get title() {
      return L.wc2Title;
    },
    w: 0,
    // 다쳐 있으면 오지 않고 스토리가 그대로 지나간다(결말: 다음 월드컵을 향해).
    expireEnding: WC_NEXT,
    cond: (s) => s.phase === 2 && s.injury === 0,
    text: () => L.wc2Text,
    choices: [
      {
        label: () => L.wc2FightLabel,
        p: (s) => clamp(0.55 + (s.attrs.phy - 60) * 0.01 + (s.cond - 60) / 200, 0.35, 0.85),
        ok: {
          text: () => L.wc2FightOk,
          fx: (s) => {
            addStat(s, 'fame', 4);
            addStat(s, 'morale', 6);
            advanceStory(s, 'worldcup', 2);
            schedule(s, 'wc-road-3', 1, 1);
          },
        },
        fail: {
          text: () => L.wc2FightFail,
          fx: (s) => {
            s.injury = Math.max(s.injury, ri(1, 3));
            addStat(s, 'morale', -6);
            advanceStory(s, 'worldcup', 2);
            schedule(s, 'wc-road-3', 1, 1);
          },
        },
      },
      {
        label: () => L.wc2SafeLabel,
        ok: {
          text: () => L.wc2SafeOk,
          fx: (s) => {
            addStat(s, 'trust', -0.8);
            addStat(s, 'cond', 4);
            advanceStory(s, 'worldcup', 2);
            schedule(s, 'wc-road-3', 1, 1);
          },
        },
      },
    ],
  },
  // ── 3: 다음 시즌 프리시즌, 월드컵 결과로 결말이 정해진다 ──
  {
    id: 'wc-road-3',
    story: 'worldcup',
    stage: 3,
    chain: true,
    get title() {
      return L.wc3TitleHero;
    },
    w: 0,
    expireEnding: WC_NEXT,
    cond: (s) => s.phase <= 1,
    text: (s) => wcBackText(s),
    choices: [
      {
        label: () => L.wc3TalkLabel,
        p: (s) => clamp(0.45 + s.trust * 0.04 + (s.age - 24) * 0.015, 0.25, 0.8),
        ok: {
          text: () => L.wc3TalkOk,
          fx: (s) => {
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 3);
            endWc(s);
          },
        },
        fail: {
          text: () => L.wc3TalkFail,
          fx: (s) => {
            addStat(s, 'fame', 1);
            addStat(s, 'morale', -5);
            addStat(s, 'trust', -0.5);
            endWc(s);
          },
        },
      },
      {
        label: () => L.wc3BackLabel,
        ok: {
          text: () => L.wc3BackOk,
          fx: (s) => {
            addStat(s, 'trust', 1);
            addStat(s, 'cond', 6);
            endWc(s);
          },
        },
      },
    ],
  },

  // ── 대표팀 대회 우승 뒤 퍼레이드(월드컵 · 대륙컵 · 올림픽 · 아시안게임) ──
  {
    id: 'nat-parade',
    get title() {
      return L.paradeTitle;
    },
    w: 6,
    cond: (s) =>
      isPro(s) &&
      s.phase === 0 &&
      once(s, 'parade') &&
      lastTours(s).some((t) => t.inSquad && WON.has(t.stage)),
    text: () => L.paradeText,
    choices: [
      {
        label: () => L.paradeRideLabel,
        ok: {
          text: () => L.paradeRideOk,
          fx: (s) => {
            mark(s, 'parade');
            addStat(s, 'fame', 8);
            addStat(s, 'morale', 6);
            addStat(s, 'cond', -8);
            addStat(s, 'trust', -1);
          },
        },
      },
      {
        label: () => L.paradeSkipLabel,
        ok: {
          text: () => L.paradeSkipOk,
          fx: (s) => {
            mark(s, 'parade');
            addStat(s, 'trust', 1.5);
            addStat(s, 'fame', 2);
            addStat(s, 'morale', 2);
          },
        },
      },
    ],
  },
  // ── 대표팀 대회를 치른 여름 뒤 짧은 휴가 ──
  {
    id: 'post-tour-rest',
    get title() {
      return L.restTitle;
    },
    w: 4,
    cond: (s) =>
      isPro(s) &&
      s.phase === 0 &&
      !storyActive(s, 'worldcup') &&
      lastTours(s).some((t) => t.inSquad && t.apps >= 3),
    text: () => L.restText,
    choices: [
      {
        label: () => L.restFullLabel,
        ok: {
          text: () => L.restFullOk,
          fx: (s) => {
            addStat(s, 'cond', 12);
            addStat(s, 'morale', 3);
            addStat(s, 'trust', -1);
          },
        },
      },
      {
        label: () => L.restEarlyLabel,
        p: (s) => clamp(0.5 + (s.cond - 60) / 120 + (32 - s.age) * 0.02, 0.2, 0.85),
        ok: {
          text: () => L.restEarlyOk,
          fx: (s) => {
            addStat(s, 'trust', 1.5);
            addStat(s, 'fame', 1);
            addStat(s, 'cond', -4);
          },
        },
        fail: {
          text: () => L.restEarlyFail,
          fx: (s) => {
            s.injury = Math.max(s.injury, ri(1, 3));
            addStat(s, 'cond', -6);
            addStat(s, 'morale', -3);
          },
        },
      },
    ],
  },
  // ── 대륙컵(유로 · 코파 아메리카 · 아시안컵 · 네이션스컵 · 골드컵) 해의 조기 소집 ──
  {
    id: 'cont-cup-eve',
    get title() {
      return L.contEveTitle;
    },
    w: 4,
    cond: (s) =>
      isPro(s) &&
      s.phase === 2 &&
      s.nat.caps > 0 &&
      natOpen(s) &&
      contCupConf(s) !== null &&
      callupScore(s) >= NT_THRESHOLD - 2,
    text: (s) => L.contEveText({ conf: contCupConf(s) ?? 'AFC' }),
    choices: [
      {
        label: () => L.contEveGoLabel,
        ok: {
          text: () => L.contEveGoOk,
          fx: (s) => {
            addStat(s, 'morale', 4);
            addStat(s, 'fame', 2);
            addStat(s, 'cond', 3);
            addStat(s, 'trust', -1.5);
          },
        },
      },
      {
        label: () => L.contEveStayLabel,
        ok: {
          text: () => L.contEveStayOk,
          fx: (s) => {
            addStat(s, 'trust', 1.5);
            addStat(s, 'cond', -4);
            addStat(s, 'morale', -1);
          },
        },
      },
    ],
  },
  // ── 올림픽 · 아시안게임 와일드카드(24세 이상). 답은 national.ts squadRole이 읽는다 ──
  {
    id: 'oa-wildcard',
    get title() {
      return L.oaTitle;
    },
    w: 5,
    cond: (s) => {
      const key = oaKey(s);
      return (
        !!key &&
        isPro(s) &&
        s.phase === 2 &&
        s.age >= 24 &&
        s.age <= 31 &&
        !s.nat?.retired &&
        s.flags[oaFlag(key, s.year)] === undefined &&
        callupScore(s) >= 78
      );
    },
    text: (s) => oaText(s),
    choices: [
      {
        label: () => L.oaAcceptLabel,
        p: (s) =>
          clamp(
            0.4 +
              s.trust * 0.05 +
              (s.fame - 30) * 0.004 +
              (leagueOf(s.leagueId).tier <= 2 ? 0.25 : 0),
            0.2,
            0.9,
          ),
        ok: {
          text: () => L.oaAcceptOk,
          fx: (s) => {
            s.flags[oaFlag(oaKey(s) ?? 'olympic', s.year)] = true;
            addStat(s, 'morale', 5);
            addStat(s, 'trust', -0.5);
          },
        },
        fail: {
          text: () => L.oaAcceptFail,
          fx: (s) => {
            s.flags[oaFlag(oaKey(s) ?? 'olympic', s.year)] = false;
            addStat(s, 'morale', -5);
          },
        },
      },
      {
        label: () => L.oaDeclineLabel,
        ok: {
          text: () => L.oaDeclineOk,
          fx: (s) => {
            s.flags[oaFlag(oaKey(s) ?? 'olympic', s.year)] = false;
            addStat(s, 'trust', 1.5);
            addStat(s, 'cond', 6);
          },
        },
      },
    ],
  },
  // ── 발롱도르 시상식(지난 시즌 30인 후보) ──
  {
    id: 'ballon-gala',
    get title() {
      return L.galaTitle;
    },
    w: 6,
    cond: (s) => isPro(s) && s.phase === 1 && (s.ballon ?? []).some((b) => b.year === s.year - 1),
    text: (s) => L.galaText({ rank: ballonRank(s) }),
    choices: [
      {
        label: () => L.galaGoLabel,
        ok: {
          text: () => L.galaGoOk,
          fx: (s) => {
            const r = ballonRank(s);
            addStat(s, 'fame', r === 1 ? 6 : r <= 10 ? 4 : 3);
            addStat(s, 'morale', 5);
            addStat(s, 'cond', -6);
          },
        },
      },
      {
        label: () => L.galaSkipLabel,
        ok: {
          text: () => L.galaSkipOk,
          fx: (s) => {
            addStat(s, 'trust', 1.5);
            addStat(s, 'cond', 4);
            addStat(s, 'fame', 1);
          },
        },
      },
    ],
  },
  // ── 챔피언스리그 첫 경기, 앤섬 ──
  {
    id: 'ucl-anthem',
    get title() {
      return L.anthemTitle;
    },
    w: 5,
    cond: (s) => isPro(s) && s.phase === 1 && !s.flags.uclAnthem && contComp(s)?.key === 'UCL',
    text: () => L.anthemText,
    choices: [
      {
        label: () => L.anthemListenLabel,
        p: (s) =>
          clamp(
            0.45 + (s.morale - 50) / 150 + (ovr(s) - leagueOf(s.leagueId).avg) * 0.02,
            0.2,
            0.8,
          ),
        ok: {
          text: () => L.anthemListenOk,
          fx: (s) => {
            s.flags.uclAnthem = s.year;
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 6);
          },
        },
        fail: {
          text: () => L.anthemListenFail,
          fx: (s) => {
            s.flags.uclAnthem = s.year;
            addStat(s, 'morale', -4);
            addStat(s, 'trust', -1);
          },
        },
      },
      {
        label: () => L.anthemRoutineLabel,
        ok: {
          text: () => L.anthemRoutineOk,
          fx: (s) => {
            s.flags.uclAnthem = s.year;
            addStat(s, 'trust', 1);
            addStat(s, 'morale', 1);
          },
        },
      },
    ],
  },
  // ── 대륙 대회 원정(리베르타도레스 고지대 · 챔피언스컵 멕시코시티 · AFC 장거리 원정) ──
  {
    id: 'cont-away',
    get title() {
      return L.awayTitle;
    },
    w: 3,
    cond: (s) => {
      const k = contComp(s)?.key;
      return (
        isPro(s) &&
        s.phase === 1 &&
        s.injury === 0 &&
        (k === 'LIB' || k === 'CCC' || k === 'ACLE' || k === 'ACL2')
      );
    },
    text: (s) => L.awayText({ key: contComp(s)?.key ?? 'ACLE' }),
    choices: [
      {
        label: () => L.awayPressLabel,
        p: (s) => clamp(0.35 + (s.attrs.phy - 60) * 0.012 + (s.cond - 60) / 200, 0.15, 0.75),
        ok: {
          text: () => L.awayPressOk,
          fx: (s) => {
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 5);
            addStat(s, 'cond', -4);
          },
        },
        fail: {
          text: () => L.awayPressFail,
          fx: (s) => {
            addStat(s, 'cond', -10);
            addStat(s, 'morale', -4);
          },
        },
      },
      {
        label: () => L.awayKeepLabel,
        ok: {
          text: () => L.awayKeepOk,
          fx: (s) => {
            addStat(s, 'trust', 1);
            addStat(s, 'cond', -2);
          },
        },
      },
    ],
  },
  // ── 대륙 대회 결승에서 진 밤의 준우승 메달 ──
  {
    id: 'cont-final-medal',
    get title() {
      return L.medalTitle;
    },
    w: 6,
    cond: (s) => isPro(s) && s.phase === 2 && once(s, 'medal') && contComp(s)?.stage === RUNNER_UP,
    text: (s) => L.medalText({ comp: contComp(s)?.name ?? '' }),
    choices: [
      {
        label: () => L.medalWearLabel,
        ok: {
          text: () => L.medalWearOk,
          fx: (s) => {
            mark(s, 'medal');
            addStat(s, 'fame', 3);
            addStat(s, 'trust', 1);
            addStat(s, 'morale', -2);
          },
        },
      },
      {
        label: () => L.medalOffLabel,
        p: () => 0.5,
        ok: {
          text: () => L.medalOffOk,
          fx: (s) => {
            mark(s, 'medal');
            addStat(s, 'fame', 4);
            addStat(s, 'morale', 3);
          },
        },
        fail: {
          text: () => L.medalOffFail,
          fx: (s) => {
            mark(s, 'medal');
            addStat(s, 'fame', 1);
            addStat(s, 'trust', -1);
            addStat(s, 'morale', -3);
          },
        },
      },
    ],
  },
  // ── 여름 이적시장 마감일 ──
  {
    id: 'deadline-day',
    get title() {
      return L.deadlineTitle;
    },
    w: 2,
    cond: (s) =>
      isPro(s) &&
      s.phase === 0 &&
      !!s.contract &&
      !s.flags.scouted &&
      !(s.mil && s.mil.serving) &&
      leagueOf(s.leagueId).tier < 8 &&
      ovr(s) >= leagueOf(s.leagueId).avg + 3,
    text: () => L.deadlineText,
    choices: [
      {
        label: () => L.deadlineGoLabel,
        p: (s) => clamp(0.35 + s.trust * 0.03 + (s.fame - 30) * 0.004, 0.15, 0.65),
        ok: {
          text: () => L.deadlineGoOk,
          fx: (s) => {
            s.flags.scouted = true;
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.deadlineGoFail,
          fx: (s) => {
            addStat(s, 'trust', -1.5);
            addStat(s, 'morale', -6);
          },
        },
      },
      {
        label: () => L.deadlineStayLabel,
        ok: {
          text: () => L.deadlineStayOk,
          fx: (s) => {
            addStat(s, 'trust', 1.5);
            addStat(s, 'morale', 1);
          },
        },
      },
    ],
  },
  // ── 리그 최종전의 득점왕 경쟁 ──
  {
    id: 'golden-boot',
    get title() {
      return L.bootTitle;
    },
    w: 5,
    cond: (s) => {
      if (!isPro(s) || s.phase !== 2 || (s.pos !== 'FW' && s.pos !== 'MF')) return false;
      const top = leagueOf(s.leagueId).matches * TOP_G;
      return s.season.goals >= Math.max(8, top - 3) && s.season.goals <= top + 1;
    },
    text: () => L.bootText,
    choices: [
      {
        label: () => L.bootAskLabel,
        p: (s) => clamp(0.3 + s.trust * 0.04 + (s.attrs.sho - 65) * 0.01, 0.15, 0.75),
        ok: {
          text: () => L.bootAskOk,
          fx: (s) => {
            s.season.goals++;
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.bootAskFail,
          fx: (s) => {
            addStat(s, 'trust', -1.5);
            addStat(s, 'morale', -4);
            addStat(s, 'fame', 1);
          },
        },
      },
      {
        label: () => L.bootTeamLabel,
        ok: {
          text: () => L.bootTeamOk,
          fx: (s) => {
            addStat(s, 'trust', 1.2);
            addStat(s, 'morale', 1);
          },
        },
      },
    ],
  },
  // ── 한 구단 오래 뛴 베테랑의 기념 경기 ──
  {
    id: 'testimonial',
    get title() {
      return L.testiTitle;
    },
    w: 4,
    cond: (s) =>
      isPro(s) && s.phase === 0 && s.age >= 31 && !s.flags.testimonial && clubSeasons(s) >= 7,
    text: (s) => L.testiText({ n: clubSeasons(s) + 1, club: s.club.name }),
    choices: [
      {
        label: () => L.testiGiveLabel,
        ok: {
          text: () => L.testiGiveOk,
          fx: (s) => {
            s.flags.testimonial = s.year;
            addStat(s, 'fame', 7);
            addStat(s, 'morale', 5);
          },
        },
      },
      {
        label: (s) => L.testiKeepLabel({ fee: fmtMoney(testiFee(s)) }),
        ok: {
          text: () => L.testiKeepOk,
          fx: (s) => {
            s.flags.testimonial = s.year;
            addStat(s, 'money', testiFee(s));
            addStat(s, 'fame', 2);
            addStat(s, 'morale', 2);
          },
        },
      },
    ],
  },
  // ── FIFA 클럽 월드컵(4년마다 여름, 2029년부터) ──
  {
    id: 'club-wc',
    get title() {
      return L.cwcTitle;
    },
    w: 5,
    cond: (s) => isPro(s) && s.phase === 0 && s.year % 4 === 1 && s.club.str >= 82,
    text: () => L.cwcText,
    choices: [
      {
        label: () => L.cwcAllLabel,
        p: (s) => clamp(0.4 + (ovr(s) - s.club.str) * 0.03 + (s.cond - 60) / 200, 0.15, 0.75),
        ok: {
          text: () => L.cwcAllOk,
          fx: (s) => {
            addStat(s, 'fame', 6);
            addStat(s, 'money', Math.round(adFee(s) / 20) * 10);
            addStat(s, 'morale', 4);
            addStat(s, 'cond', -10);
          },
        },
        fail: {
          text: () => L.cwcAllFail,
          fx: (s) => {
            addStat(s, 'cond', -12);
            addStat(s, 'morale', -4);
          },
        },
      },
      {
        label: () => L.cwcRestLabel,
        ok: {
          text: () => L.cwcRestOk,
          fx: (s) => {
            addStat(s, 'cond', 8);
            addStat(s, 'trust', -1);
          },
        },
      },
    ],
  },
  // ── A매치 기간 뒤 장거리 비행(대표팀과 소속 리그의 대륙이 다를 때) ──
  {
    id: 'intl-flight',
    get title() {
      return L.flightTitle;
    },
    w: 3,
    cond: (s) =>
      isPro(s) &&
      s.phase > 0 &&
      s.injury === 0 &&
      nationOf(s).conf !== leagueConf(s) &&
      (s.nat?.caps ?? 0) > (s.season.capsStart ?? s.nat?.caps ?? 0),
    text: () => L.flightText,
    choices: [
      {
        label: () => L.flightPlayLabel,
        p: (s) => clamp(0.45 + (s.cond - 60) / 100 + (30 - s.age) * 0.015, 0.2, 0.85),
        ok: {
          text: () => L.flightPlayOk,
          fx: (s) => {
            addStat(s, 'trust', 1.5);
            addStat(s, 'fame', 2);
            addStat(s, 'cond', -6);
          },
        },
        fail: {
          text: () => L.flightPlayFail,
          fx: (s) => {
            s.injury = Math.max(s.injury, ri(1, 2));
            addStat(s, 'cond', -6);
          },
        },
      },
      {
        label: () => L.flightRestLabel,
        ok: {
          text: () => L.flightRestOk,
          fx: (s) => {
            addStat(s, 'cond', 10);
            addStat(s, 'trust', -1);
          },
        },
      },
    ],
  },
];
