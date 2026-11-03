// 시즌 2 이벤트 다양화(variety-events.ts, T-11-543) 문구 묶음 — 문구는 gVariety.
import type { EventText } from '../../events-data';
import { fmtMoney, trainerFee } from '../../engine';
import { gVariety as V } from './gVariety';

export const events_variety: Record<string, EventText> = {
  'am-exam': {
    title: V.examTitle,
    text: () => V.examText,
    choices: [
      { label: V.examTrainLabel, ok: V.examTrainOk, fail: V.examTrainFail },
      { label: V.examStudyLabel, ok: V.examStudyOk },
    ],
  },
  'am-parents': {
    title: V.parentsTitle,
    text: () => V.parentsText,
    choices: [
      { label: V.parentsPersuadeLabel, ok: V.parentsPersuadeOk, fail: V.parentsPersuadeFail },
      { label: V.parentsBothLabel, ok: V.parentsBothOk },
    ],
  },
  'am-senior': {
    title: V.seniorTitle,
    text: () => V.seniorText,
    choices: [
      { label: V.seniorTalkLabel, ok: V.seniorTalkOk, fail: V.seniorTalkFail },
      { label: V.seniorBearLabel, ok: V.seniorBearOk },
    ],
  },
  'am-captain': {
    title: V.captainTitle,
    text: () => V.captainText,
    choices: [
      { label: V.captainTakeLabel, ok: V.captainTakeOk, fail: V.captainTakeFail },
      { label: V.captainDeclineLabel, ok: V.captainDeclineOk },
    ],
  },
  'am-friendly': {
    title: V.friendlyTitle,
    text: () => V.friendlyText,
    choices: [
      { label: V.friendlyBoldLabel, ok: V.friendlyBoldOk, fail: V.friendlyBoldFail },
      { label: V.friendlySafeLabel, ok: V.friendlySafeOk },
    ],
  },
  'mf-switch': {
    title: V.switchTitle,
    text: () => V.switchText,
    choices: [
      { label: V.switchLongLabel, ok: V.switchLongOk, fail: V.switchLongFail },
      { label: V.switchShortLabel, ok: V.switchShortOk },
    ],
  },
  'mf-tempo': {
    title: V.tempoTitle,
    text: () => V.tempoText,
    choices: [
      { label: V.tempoKeepLabel, ok: V.tempoKeepOk, fail: V.tempoKeepFail },
      { label: V.tempoKillLabel, ok: V.tempoKillOk, fail: V.tempoKillFail },
    ],
  },
  'fw-cross': {
    title: V.crossTitle,
    text: () => V.crossText,
    choices: [
      { label: V.crossNearLabel, ok: V.crossNearOk, fail: V.crossNearFail },
      { label: V.crossFarLabel, ok: V.crossFarOk, fail: V.crossFarFail },
    ],
  },
  'fw-chase': {
    title: V.chaseTitle,
    text: () => V.chaseText,
    choices: [
      { label: V.chaseRunLabel, ok: V.chaseRunOk, fail: V.chaseRunFail },
      { label: V.chaseHoldLabel, ok: V.chaseHoldOk },
    ],
  },
  'df-trap': {
    title: V.trapTitle,
    text: () => V.trapText,
    choices: [
      { label: V.trapUpLabel, ok: V.trapUpOk, fail: V.trapUpFail },
      { label: V.trapDropLabel, ok: V.trapDropOk },
    ],
  },
  'young-advice': {
    title: V.adviceTitle,
    text: () => V.adviceText,
    choices: [
      { label: V.adviceJoinLabel, ok: V.adviceJoinOk, fail: V.adviceJoinFail },
      { label: V.adviceOwnLabel, ok: V.adviceOwnOk },
    ],
  },
  'young-sns': {
    title: V.snsTitle,
    text: () => V.snsText,
    choices: [
      { label: V.snsReplyLabel, ok: V.snsReplyOk, fail: V.snsReplyFail },
      { label: V.snsOffLabel, ok: V.snsOffOk },
    ],
  },
  'vet-recovery': {
    title: V.recoveryTitle,
    text: (s) => V.recoveryText({ fee: fmtMoney(trainerFee(s)) }),
    choices: [
      { label: V.recoveryHireLabel, ok: V.recoveryHireOk },
      { label: V.recoveryRestLabel, ok: V.recoveryRestOk, fail: V.recoveryRestFail },
    ],
  },
  'vet-mentor': {
    title: V.mentorTitle,
    text: () => V.mentorText,
    choices: [
      { label: V.mentorTeachLabel, ok: V.mentorTeachOk },
      { label: V.mentorRestLabel, ok: V.mentorRestOk },
    ],
  },
};
