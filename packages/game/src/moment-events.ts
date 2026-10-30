// ───────── 커리어 장면 이벤트 ─────────
// 사인 요청·월드컵 명단 탈락·대표팀 레전드의 비판·해트트릭·파파라치·은사의 별세. 문구는 i18n/ko/gMoments.ts.
import { clamp } from './rng.js';
import { isPro, addStat } from './engine.js';
import { natRefusing } from './national.js';
import { gMomentsText as L } from './i18n/ko/gMoments.js';
import type { EventDef, GameState } from './types.js';

/** 이번 시즌 리그 평균 평점(출전 전엔 6.6 — national.ts callupScore와 같다). */
const form = (s: GameState) => (s.season.apps ? s.season.ratingSum / s.season.apps : 6.6);

export const MOMENT_EVENTS: EventDef[] = [
  {
    id: 'kid-autograph',
    get title() {
      return L.kidTitle;
    },
    w: 1.2,
    cond: (s) => isPro(s) && s.fame >= 20 && s.phase > 0,
    text: (s) => L.kidText({ name: s.name }),
    choices: [
      {
        label: () => L.kidShirtLabel,
        ok: {
          text: () => L.kidShirtResult,
          fx: (s) => {
            addStat(s, 'fame', 4);
            addStat(s, 'morale', 1);
          },
        },
      },
      {
        label: () => L.kidSignLabel,
        ok: {
          text: () => L.kidSignResult,
          fx: (s) => {
            addStat(s, 'morale', 7);
            addStat(s, 'fame', 1);
            addStat(s, 'cond', -3);
          },
        },
      },
    ],
  },
  {
    // 지난 시즌(월드컵 해) 본선에 나갔는데 최종 명단에 들지 못한 A대표 경력 선수에게 새 시즌 프리시즌에 온다.
    // T-11-265 대표팀 은퇴를 발표했으면 오지 않는다(은퇴한 해의 월드컵 명단 탈락으로 소집 거부를 묻지 않는다).
    id: 'wc-snub',
    get title() {
      return L.wcTitle;
    },
    w: 10,
    cond: (s) =>
      isPro(s) &&
      s.phase === 0 &&
      s.nat.caps > 0 &&
      !s.nat.retired &&
      !natRefusing(s) &&
      s.nat.tours.some((t) => t.year === s.year - 1 && t.name.includes('FIFA') && !t.inSquad),
    text: () => L.wcText,
    choices: [
      {
        label: () => L.wcQuitLabel,
        ok: {
          text: () => L.wcQuitResult,
          fx: (s) => {
            // 이번 시즌과 다음 시즌 A대표팀 소집·대회 명단에서 빠진다(다음 월드컵 예선 해에 돌아온다).
            s.flags.natQuit = s.year + 1;
            s.nat.captain = false;
            addStat(s, 'fame', 4);
            addStat(s, 'morale', 5);
          },
        },
      },
      {
        label: () => L.wcCalmLabel,
        ok: {
          text: () => L.wcCalmResult,
          fx: (s) => {
            addStat(s, 'morale', 2);
            addStat(s, 'trust', 1);
          },
        },
      },
    ],
  },
  {
    id: 'legend-critic',
    get title() {
      return L.legendTitle;
    },
    w: 1,
    cond: (s) => isPro(s) && s.phase > 0 && s.nat.caps > 0 && s.fame >= 40,
    text: () => L.legendText,
    choices: [
      {
        label: () => L.legendReplyLabel,
        p: (s) => clamp(0.35 + (form(s) - 6.8) * 0.3 + (s.fame - 50) / 300, 0.1, 0.8),
        ok: {
          text: () => L.legendReplyOk,
          fx: (s) => {
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.legendReplyFail,
          fx: (s) => {
            addStat(s, 'fame', 1);
            addStat(s, 'morale', -6);
            addStat(s, 'trust', -1);
          },
        },
      },
      {
        label: () => L.legendIgnoreLabel,
        ok: {
          text: () => L.legendIgnoreResult,
          fx: (s) => {
            addStat(s, 'trust', 0.5);
          },
        },
      },
    ],
  },
  {
    id: 'hat-trick',
    get title() {
      return L.hatTitle;
    },
    w: 1.5,
    cond: (s) =>
      isPro(s) &&
      s.phase > 0 &&
      s.pos !== 'GK' &&
      s.season.goals >= 3 &&
      !s.flags['hatTrick' + s.year],
    text: () => L.hatText,
    choices: [
      {
        label: () => L.hatTeamLabel,
        ok: {
          text: () => L.hatTeamResult,
          fx: (s) => {
            s.flags['hatTrick' + s.year] = 1;
            addStat(s, 'trust', 1.5);
            addStat(s, 'morale', 4);
            addStat(s, 'fame', 3);
          },
        },
      },
      {
        label: () => L.hatFatherLabel,
        ok: {
          text: () => L.hatFatherResult,
          fx: (s) => {
            s.flags['hatTrick' + s.year] = 1;
            addStat(s, 'morale', 7);
            addStat(s, 'fame', 5);
          },
        },
      },
    ],
  },
  {
    id: 'paparazzi',
    get title() {
      return L.papTitle;
    },
    w: 0.8,
    cond: (s) => s.age >= 20 && isPro(s) && s.fame >= 40 && s.phase > 0,
    text: () => L.papText,
    choices: [
      {
        label: () => L.papSmileLabel,
        ok: {
          text: () => L.papSmileResult,
          fx: (s) => {
            addStat(s, 'fame', 3);
            addStat(s, 'morale', 2);
          },
        },
      },
      {
        label: () => L.papRunLabel,
        p: (s) => clamp(0.3 + (s.attrs.pac - 60) * 0.015, 0.15, 0.8),
        ok: {
          text: () => L.papRunOk,
          fx: (s) => {
            addStat(s, 'morale', 3);
          },
        },
        fail: {
          text: () => L.papRunFail,
          fx: (s) => {
            addStat(s, 'fame', 3);
            addStat(s, 'morale', -5);
          },
        },
      },
    ],
  },
  {
    id: 'coach-farewell',
    get title() {
      return L.coachTitle;
    },
    w: 0.5,
    cond: (s) => isPro(s) && s.age >= 22 && s.phase > 0 && !s.flags.coachFarewell,
    text: () => L.coachText,
    choices: [
      {
        label: () => L.coachFuneralLabel,
        ok: {
          text: () => L.coachFuneralResult,
          fx: (s) => {
            s.flags.coachFarewell = true;
            s.injury = Math.max(s.injury, 1);
            addStat(s, 'morale', 8);
            addStat(s, 'fame', 3);
          },
        },
      },
      {
        label: () => L.coachDedicateLabel,
        p: (s) => clamp(0.3 + (s.morale - 55) / 100 + (form(s) - 6.8) * 0.2, 0.15, 0.8),
        ok: {
          text: () => L.coachDedicateOk,
          fx: (s) => {
            s.flags.coachFarewell = true;
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 6);
            addStat(s, 'trust', 1);
          },
        },
        fail: {
          text: () => L.coachDedicateFail,
          fx: (s) => {
            s.flags.coachFarewell = true;
            addStat(s, 'morale', -6);
          },
        },
      },
    ],
  },
];
