// 이벤트 일본어 문구(events-data.ts EventText) — 이벤트 id → 문구. 정의 모듈별 파일을 묶는다.
import { gDating as D } from './gDating';
import { gLife as F } from './gLife';
import { gMoments as M } from './gMoments';
import type { EventText } from '../../events-data';
import { events_base } from './events-base';
import { events_military } from './events-military';
import { events_positional } from './events-positional';
import { events_real } from './events-real';
import { events_story } from './events-story';

export const events: Record<string, EventText> = {
  'dating-rumor': {
    title: D.title,
    text: () => D.text,
    choices: [
      { label: D.privateLabel, ok: D.privateResult },
      { label: D.confirmLabel, ok: D.confirmResult },
      { label: D.pitchLabel, ok: D.pitchResult },
    ],
  },
  'nt-retire': {
    title: F.ntTitle,
    text: (s) => F.ntText({ caps: s.nat.caps }),
    choices: [
      { label: F.ntRetireLabel, ok: (s) => F.ntRetireResult({ caps: s.nat.caps }) },
      { label: F.ntStayLabel, ok: F.ntStayResult },
    ],
  },
  'party-wags': {
    title: F.wagsTitle,
    text: () => F.wagsText,
    choices: [
      { label: F.wagsPublicLabel, ok: F.wagsPublicResult, fail: F.wagsPublicFail },
      { label: F.wagsQuietLabel, ok: F.wagsQuietResult },
      { label: F.wagsDeclineLabel, ok: F.wagsDeclineResult },
    ],
  },
  'kid-autograph': {
    title: M.kidTitle,
    text: (s) => M.kidText({ name: s.name }),
    choices: [
      { label: M.kidShirtLabel, ok: M.kidShirtResult },
      { label: M.kidSignLabel, ok: M.kidSignResult },
    ],
  },
  'wc-snub': {
    title: M.wcTitle,
    text: () => M.wcText,
    choices: [
      { label: M.wcQuitLabel, ok: M.wcQuitResult },
      { label: M.wcCalmLabel, ok: M.wcCalmResult },
    ],
  },
  'legend-critic': {
    title: M.legendTitle,
    text: () => M.legendText,
    choices: [
      { label: M.legendReplyLabel, ok: M.legendReplyOk, fail: M.legendReplyFail },
      { label: M.legendIgnoreLabel, ok: M.legendIgnoreResult },
    ],
  },
  'hat-trick': {
    title: M.hatTitle,
    text: () => M.hatText,
    choices: [
      { label: M.hatTeamLabel, ok: M.hatTeamResult },
      { label: M.hatFatherLabel, ok: M.hatFatherResult },
    ],
  },
  paparazzi: {
    title: M.papTitle,
    text: () => M.papText,
    choices: [
      { label: M.papSmileLabel, ok: M.papSmileResult },
      { label: M.papRunLabel, ok: M.papRunOk, fail: M.papRunFail },
    ],
  },
  'coach-farewell': {
    title: M.coachTitle,
    text: () => M.coachText,
    choices: [
      { label: M.coachFuneralLabel, ok: M.coachFuneralResult },
      { label: M.coachDedicateLabel, ok: M.coachDedicateOk, fail: M.coachDedicateFail },
    ],
  },
  ...events_base,
  ...events_real,
  ...events_story,
  ...events_positional,
  ...events_military,
};
