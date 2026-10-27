// ───────── 시즌 2 이벤트 다양화 (T-11-543) ─────────
// 시즌 1에 커리어를 여러 번 돈 유저가 같은 이벤트를 반복해서 봤다. 이벤트가 거의 없던 고교 · 대학 시절과 포지션별
// 경기 장면, 어린 선수(18~21세) · 베테랑(32세 이상)의 장면을 더한다. 효과의 크기는 비슷한 기존 이벤트(positional.ts ·
// events.ts)에 맞췄다. 문구는 i18n/ko/gVariety.ts. 포지션 이벤트 id는 dexGroups.posOf가 읽는 접두사(fw-·mf-·df-)로 시작한다.
import { clamp } from './rng.js';
import { addStat, addAttr, fmtMoney, isPro, leagueOf, pkWin, trainerFee } from './engine.js';
import { ovr } from './attributes.js';
import { gVarietyText as L } from './i18n/ko/gVariety.js';
import type { EventDef, GameState } from './types.js';

const isAmateur = (s: GameState) => !!leagueOf(s.leagueId).amateur;
const inGame = (s: GameState) => s.phase > 0 && s.injury === 0;

export const VARIETY_EVENTS: EventDef[] = [
  // ── 고교 · 대학 ──
  {
    id: 'am-exam',
    get title() {
      return L.examTitle;
    },
    w: 3,
    cond: (s) => s.leagueId === 'hs',
    text: () => L.examText,
    choices: [
      {
        label: () => L.examTrainLabel,
        p: (s) => clamp(0.45 + (s.cond - 60) / 150, 0.25, 0.8),
        ok: {
          text: () => L.examTrainOk,
          fx: (s) => {
            addAttr(s, 'pac', 1);
            addStat(s, 'trust', 1);
            addStat(s, 'cond', -6);
          },
        },
        fail: {
          text: () => L.examTrainFail,
          fx: (s) => {
            addStat(s, 'morale', -5);
            addStat(s, 'trust', -0.5);
          },
        },
      },
      {
        label: () => L.examStudyLabel,
        ok: {
          text: () => L.examStudyOk,
          fx: (s) => {
            addStat(s, 'cond', 8);
            addStat(s, 'morale', 3);
          },
        },
      },
    ],
  },
  {
    id: 'am-parents',
    get title() {
      return L.parentsTitle;
    },
    w: 2,
    cond: (s) => s.leagueId === 'hs' && s.phase <= 1,
    text: () => L.parentsText,
    choices: [
      {
        label: () => L.parentsPersuadeLabel,
        p: (s) => clamp(0.45 + (ovr(s) - s.club.str) * 0.03 + (s.morale - 50) / 200, 0.2, 0.85),
        ok: {
          text: () => L.parentsPersuadeOk,
          fx: (s) => {
            addStat(s, 'morale', 8);
            addStat(s, 'cond', 4);
          },
        },
        fail: {
          text: () => L.parentsPersuadeFail,
          fx: (s) => addStat(s, 'morale', -5),
        },
      },
      {
        label: () => L.parentsBothLabel,
        ok: {
          text: () => L.parentsBothOk,
          fx: (s) => {
            addStat(s, 'morale', 3);
            addStat(s, 'cond', -3);
          },
        },
      },
    ],
  },
  {
    id: 'am-senior',
    get title() {
      return L.seniorTitle;
    },
    w: 3,
    cond: (s) => s.leagueId === 'uni' && s.uniYears <= 1,
    text: () => L.seniorText,
    choices: [
      {
        label: () => L.seniorTalkLabel,
        p: (s) => clamp(0.4 + s.trust * 0.05 + (ovr(s) - s.club.str) * 0.02, 0.15, 0.8),
        ok: {
          text: () => L.seniorTalkOk,
          fx: (s) => {
            addStat(s, 'morale', 6);
            addStat(s, 'trust', 1);
          },
        },
        fail: {
          text: () => L.seniorTalkFail,
          fx: (s) => {
            addStat(s, 'trust', -1);
            addStat(s, 'morale', -5);
          },
        },
      },
      {
        label: () => L.seniorBearLabel,
        ok: {
          text: () => L.seniorBearOk,
          fx: (s) => {
            addAttr(s, 'dri', 1);
            addStat(s, 'cond', -4);
            addStat(s, 'morale', -1);
          },
        },
      },
    ],
  },
  {
    id: 'am-captain',
    get title() {
      return L.captainTitle;
    },
    w: 2,
    cond: (s) => isAmateur(s) && s.phase <= 1 && ovr(s) >= s.club.str - 2,
    text: () => L.captainText,
    choices: [
      {
        label: () => L.captainTakeLabel,
        p: (s) => clamp(0.4 + s.trust * 0.05 + (s.morale - 50) / 150, 0.2, 0.85),
        ok: {
          text: () => L.captainTakeOk,
          fx: (s) => {
            addStat(s, 'trust', 1.5);
            addStat(s, 'fame', 3);
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.captainTakeFail,
          fx: (s) => {
            addStat(s, 'morale', -5);
            addStat(s, 'cond', -4);
          },
        },
      },
      {
        label: () => L.captainDeclineLabel,
        ok: {
          text: () => L.captainDeclineOk,
          fx: (s) => {
            addAttr(s, 'pas', 1);
            addStat(s, 'morale', 2);
          },
        },
      },
    ],
  },
  {
    id: 'am-friendly',
    get title() {
      return L.friendlyTitle;
    },
    w: 2,
    cond: (s) => isAmateur(s) && s.phase > 0 && s.injury === 0,
    text: () => L.friendlyText,
    choices: [
      {
        label: () => L.friendlyBoldLabel,
        p: (s) => clamp(0.3 + (ovr(s) - 58) * 0.03, 0.12, 0.75),
        ok: {
          text: () => L.friendlyBoldOk,
          fx: (s) => {
            addStat(s, 'fame', 6);
            addStat(s, 'morale', 6);
          },
        },
        fail: {
          text: () => L.friendlyBoldFail,
          fx: (s) => {
            addStat(s, 'morale', -5);
            addStat(s, 'cond', -5);
          },
        },
      },
      {
        label: () => L.friendlySafeLabel,
        ok: {
          text: () => L.friendlySafeOk,
          fx: (s) => {
            addStat(s, 'trust', 1);
            addAttr(s, 'pas', 0.8);
          },
        },
      },
    ],
  },

  // ── 미드필더 ──
  {
    id: 'mf-switch',
    get title() {
      return L.switchTitle;
    },
    w: 2,
    cond: (s) => s.pos === 'MF' && inGame(s),
    text: () => L.switchText,
    choices: [
      {
        label: () => L.switchLongLabel,
        p: (s) => clamp(0.35 + (s.attrs.pas - 62) * 0.012, 0.15, 0.75),
        ok: {
          text: () => L.switchLongOk,
          fx: (s) => {
            s.season.assists++;
            addStat(s, 'fame', 3);
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.switchLongFail,
          fx: (s) => {
            addStat(s, 'trust', -0.5);
            addStat(s, 'morale', -3);
          },
        },
      },
      {
        label: () => L.switchShortLabel,
        ok: {
          text: () => L.switchShortOk,
          fx: (s) => addStat(s, 'trust', 0.8),
        },
      },
    ],
  },
  {
    id: 'mf-tempo',
    get title() {
      return L.tempoTitle;
    },
    w: 2,
    cond: (s) => s.pos === 'MF' && inGame(s),
    text: () => L.tempoText,
    choices: [
      {
        label: () => L.tempoKeepLabel,
        p: (s) => clamp(0.45 + (s.attrs.pas - 60) * 0.012 + (s.attrs.dri - 60) * 0.006, 0.2, 0.85),
        ok: {
          text: () => L.tempoKeepOk,
          fx: (s) => {
            pkWin(s);
            addStat(s, 'trust', 1.5);
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.tempoKeepFail,
          fx: (s) => {
            addStat(s, 'morale', -5);
            addStat(s, 'trust', -1);
          },
        },
      },
      {
        label: () => L.tempoKillLabel,
        p: (s) => clamp(0.25 + (s.attrs.sho - 62) * 0.01 + (s.attrs.pac - 60) * 0.006, 0.1, 0.6),
        mg: { kind: 'shot' },
        ok: {
          text: () => L.tempoKillOk,
          fx: (s) => {
            s.season.goals++;
            pkWin(s);
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 6);
          },
        },
        fail: {
          text: () => L.tempoKillFail,
          fx: (s) => {
            addStat(s, 'trust', -1.5);
            addStat(s, 'morale', -3);
          },
        },
      },
    ],
  },

  // ── 공격수 ──
  {
    id: 'fw-cross',
    get title() {
      return L.crossTitle;
    },
    w: 2,
    cond: (s) => s.pos === 'FW' && inGame(s),
    text: () => L.crossText,
    choices: [
      {
        label: () => L.crossNearLabel,
        p: (s) => clamp(0.3 + (s.attrs.phy - 60) * 0.01 + (s.attrs.sho - 62) * 0.008, 0.12, 0.7),
        ok: {
          text: () => L.crossNearOk,
          fx: (s) => {
            s.season.goals++;
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 8);
          },
        },
        fail: {
          text: () => L.crossNearFail,
          fx: (s) => addStat(s, 'morale', -4),
        },
      },
      {
        label: () => L.crossFarLabel,
        p: (s) => clamp(0.35 + (s.attrs.sho - 62) * 0.01, 0.15, 0.7),
        mg: { kind: 'shot' },
        ok: {
          text: () => L.crossFarOk,
          fx: (s) => {
            s.season.goals++;
            addStat(s, 'fame', 3);
            addStat(s, 'morale', 6);
          },
        },
        fail: {
          text: () => L.crossFarFail,
          fx: (s) => addStat(s, 'morale', -3),
        },
      },
    ],
  },
  {
    id: 'fw-chase',
    get title() {
      return L.chaseTitle;
    },
    w: 2,
    cond: (s) => s.pos === 'FW' && inGame(s),
    text: () => L.chaseText,
    choices: [
      {
        label: () => L.chaseRunLabel,
        p: (s) => clamp(0.3 + (s.attrs.pac - 62) * 0.012 + (s.cond - 60) / 200, 0.12, 0.7),
        ok: {
          text: () => L.chaseRunOk,
          fx: (s) => {
            s.season.goals++;
            addStat(s, 'fame', 4);
            addStat(s, 'morale', 7);
            addStat(s, 'cond', -4);
          },
        },
        fail: {
          text: () => L.chaseRunFail,
          fx: (s) => {
            addStat(s, 'cond', -6);
            addStat(s, 'morale', -2);
          },
        },
      },
      {
        label: () => L.chaseHoldLabel,
        ok: {
          text: () => L.chaseHoldOk,
          fx: (s) => {
            addStat(s, 'cond', 4);
            addStat(s, 'trust', 0.3);
          },
        },
      },
    ],
  },

  // ── 수비수 ──
  {
    id: 'df-trap',
    get title() {
      return L.trapTitle;
    },
    w: 2,
    cond: (s) => s.pos === 'DF' && inGame(s),
    text: () => L.trapText,
    choices: [
      {
        label: () => L.trapUpLabel,
        p: (s) => clamp(0.4 + (s.attrs.def - 62) * 0.012 + s.trust * 0.02, 0.15, 0.8),
        ok: {
          text: () => L.trapUpOk,
          fx: (s) => {
            s.season.cs++;
            addStat(s, 'trust', 1.5);
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.trapUpFail,
          fx: (s) => {
            addStat(s, 'morale', -6);
            addStat(s, 'trust', -1);
          },
        },
      },
      {
        label: () => L.trapDropLabel,
        ok: {
          text: () => L.trapDropOk,
          fx: (s) => addStat(s, 'trust', 0.8),
        },
      },
    ],
  },

  // ── 어린 선수(18~21세) ──
  {
    id: 'young-advice',
    get title() {
      return L.adviceTitle;
    },
    w: 2,
    cond: (s) => isPro(s) && s.age <= 21 && s.phase <= 1,
    text: () => L.adviceText,
    choices: [
      {
        label: () => L.adviceJoinLabel,
        p: (s) => clamp(0.5 + (s.cond - 60) / 150, 0.25, 0.85),
        ok: {
          text: () => L.adviceJoinOk,
          fx: (s) => {
            addAttr(s, 'pas', 1.5);
            addStat(s, 'trust', 1);
            addStat(s, 'cond', -6);
          },
        },
        fail: {
          text: () => L.adviceJoinFail,
          fx: (s) => {
            addStat(s, 'cond', -10);
            addStat(s, 'morale', -3);
          },
        },
      },
      {
        label: () => L.adviceOwnLabel,
        ok: {
          text: () => L.adviceOwnOk,
          fx: (s) => addStat(s, 'morale', 3),
        },
      },
    ],
  },
  {
    id: 'young-sns',
    get title() {
      return L.snsTitle;
    },
    w: 2,
    cond: (s) => isPro(s) && s.age <= 21 && s.phase > 0,
    text: () => L.snsText,
    choices: [
      {
        label: () => L.snsReplyLabel,
        p: (s) => clamp(0.35 + (ovr(s) - leagueOf(s.leagueId).avg) * 0.03, 0.15, 0.75),
        ok: {
          text: () => L.snsReplyOk,
          fx: (s) => {
            addStat(s, 'fame', 4);
            addStat(s, 'morale', 4);
          },
        },
        fail: {
          text: () => L.snsReplyFail,
          fx: (s) => {
            addStat(s, 'morale', -6);
            addStat(s, 'fame', 1);
          },
        },
      },
      {
        label: () => L.snsOffLabel,
        ok: {
          text: () => L.snsOffOk,
          fx: (s) => {
            addStat(s, 'morale', 2);
            addStat(s, 'cond', 3);
          },
        },
      },
    ],
  },

  // ── 베테랑(32세 이상) ──
  {
    id: 'vet-recovery',
    get title() {
      return L.recoveryTitle;
    },
    w: 2,
    cond: (s) => isPro(s) && s.age >= 32 && s.phase > 0 && s.money >= trainerFee(s),
    text: (s) => L.recoveryText({ fee: fmtMoney(trainerFee(s)) }),
    choices: [
      {
        label: () => L.recoveryHireLabel,
        ok: {
          text: () => L.recoveryHireOk,
          fx: (s) => {
            addStat(s, 'money', -trainerFee(s));
            addStat(s, 'cond', 15);
            addStat(s, 'morale', 3);
          },
        },
      },
      {
        label: () => L.recoveryRestLabel,
        p: (s) => clamp(0.4 + s.trust * 0.06, 0.15, 0.85),
        ok: {
          text: () => L.recoveryRestOk,
          fx: (s) => {
            addStat(s, 'cond', 12);
            addStat(s, 'trust', 0.5);
          },
        },
        fail: {
          text: () => L.recoveryRestFail,
          fx: (s) => {
            addStat(s, 'trust', -1);
            addStat(s, 'morale', -4);
          },
        },
      },
    ],
  },
  {
    id: 'vet-mentor',
    get title() {
      return L.mentorTitle;
    },
    w: 2,
    cond: (s) => isPro(s) && s.age >= 32,
    text: () => L.mentorText,
    choices: [
      {
        label: () => L.mentorTeachLabel,
        ok: {
          text: () => L.mentorTeachOk,
          fx: (s) => {
            addStat(s, 'trust', 1.5);
            addStat(s, 'morale', 4);
            addStat(s, 'cond', -4);
          },
        },
      },
      {
        label: () => L.mentorRestLabel,
        ok: {
          text: () => L.mentorRestOk,
          fx: (s) => addStat(s, 'cond', 8),
        },
      },
    ],
  },
];
