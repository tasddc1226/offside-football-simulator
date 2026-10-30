// 축구계 큰 무대 이벤트(bigstage-events.ts, T-11-543) 문구 묶음 — 문구는 gBigStage.
import type { EventText } from '../../events-data';
import { fmtMoney } from '../../engine';
import { contCupConf } from '../../national';
import {
  ballonRank,
  clubSeasons,
  contComp,
  oaText,
  testiFee,
  wcBackText,
} from '../../bigstage-events';
import { gBigStage as V } from './gBigStage';

export const events_bigstage: Record<string, EventText> = {
  'wc-road-1': {
    title: V.wc1Title,
    text: (s) => V.wc1Text({ year: s.year }),
    choices: [
      { label: V.wc1PushLabel, ok: V.wc1PushOk, fail: V.wc1PushFail },
      { label: V.wc1PaceLabel, ok: V.wc1PaceOk },
    ],
  },
  'wc-road-2': {
    title: V.wc2Title,
    text: () => V.wc2Text,
    choices: [
      { label: V.wc2FightLabel, ok: V.wc2FightOk, fail: V.wc2FightFail },
      { label: V.wc2SafeLabel, ok: V.wc2SafeOk },
    ],
  },
  'wc-road-3': {
    title: V.wc3TitleHero,
    text: (s) => wcBackText(s, V),
    choices: [
      { label: V.wc3TalkLabel, ok: V.wc3TalkOk, fail: V.wc3TalkFail },
      { label: V.wc3BackLabel, ok: V.wc3BackOk },
    ],
  },
  'nat-parade': {
    title: V.paradeTitle,
    text: () => V.paradeText,
    choices: [
      { label: V.paradeRideLabel, ok: V.paradeRideOk },
      { label: V.paradeSkipLabel, ok: V.paradeSkipOk },
    ],
  },
  'post-tour-rest': {
    title: V.restTitle,
    text: () => V.restText,
    choices: [
      { label: V.restFullLabel, ok: V.restFullOk },
      { label: V.restEarlyLabel, ok: V.restEarlyOk, fail: V.restEarlyFail },
    ],
  },
  'cont-cup-eve': {
    title: V.contEveTitle,
    text: (s) => V.contEveText({ conf: contCupConf(s) ?? 'AFC' }),
    choices: [
      { label: V.contEveGoLabel, ok: V.contEveGoOk },
      { label: V.contEveStayLabel, ok: V.contEveStayOk },
    ],
  },
  'oa-wildcard': {
    title: V.oaTitle,
    text: (s) => oaText(s, V),
    choices: [
      { label: V.oaAcceptLabel, ok: V.oaAcceptOk, fail: V.oaAcceptFail },
      { label: V.oaDeclineLabel, ok: V.oaDeclineOk },
    ],
  },
  'ballon-gala': {
    title: V.galaTitle,
    text: (s) => V.galaText({ rank: ballonRank(s) }),
    choices: [
      { label: V.galaGoLabel, ok: V.galaGoOk },
      { label: V.galaSkipLabel, ok: V.galaSkipOk },
    ],
  },
  'ucl-anthem': {
    title: V.anthemTitle,
    text: () => V.anthemText,
    choices: [
      { label: V.anthemListenLabel, ok: V.anthemListenOk, fail: V.anthemListenFail },
      { label: V.anthemRoutineLabel, ok: V.anthemRoutineOk },
    ],
  },
  'cont-away': {
    title: V.awayTitle,
    text: (s) => V.awayText({ key: contComp(s)?.key ?? 'ACLE' }),
    choices: [
      { label: V.awayPressLabel, ok: V.awayPressOk, fail: V.awayPressFail },
      { label: V.awayKeepLabel, ok: V.awayKeepOk },
    ],
  },
  'cont-final-medal': {
    title: V.medalTitle,
    text: (s) => V.medalText({ comp: contComp(s)?.name ?? '' }),
    choices: [
      { label: V.medalWearLabel, ok: V.medalWearOk },
      { label: V.medalOffLabel, ok: V.medalOffOk, fail: V.medalOffFail },
    ],
  },
  'deadline-day': {
    title: V.deadlineTitle,
    text: () => V.deadlineText,
    choices: [
      { label: V.deadlineGoLabel, ok: V.deadlineGoOk, fail: V.deadlineGoFail },
      { label: V.deadlineStayLabel, ok: V.deadlineStayOk },
    ],
  },
  'golden-boot': {
    title: V.bootTitle,
    text: () => V.bootText,
    choices: [
      { label: V.bootAskLabel, ok: V.bootAskOk, fail: V.bootAskFail },
      { label: V.bootTeamLabel, ok: V.bootTeamOk },
    ],
  },
  testimonial: {
    title: V.testiTitle,
    text: (s) => V.testiText({ n: clubSeasons(s) + 1, club: s.club.name }),
    choices: [
      { label: V.testiGiveLabel, ok: V.testiGiveOk },
      {
        label: (s) => V.testiKeepLabel({ fee: fmtMoney(testiFee(s)) }),
        ok: V.testiKeepOk,
      },
    ],
  },
  'club-wc': {
    title: V.cwcTitle,
    text: () => V.cwcText,
    choices: [
      { label: V.cwcAllLabel, ok: V.cwcAllOk, fail: V.cwcAllFail },
      { label: V.cwcRestLabel, ok: V.cwcRestOk },
    ],
  },
  'intl-flight': {
    title: V.flightTitle,
    text: () => V.flightText,
    choices: [
      { label: V.flightPlayLabel, ok: V.flightPlayOk, fail: V.flightPlayFail },
      { label: V.flightRestLabel, ok: V.flightRestOk },
    ],
  },
};
