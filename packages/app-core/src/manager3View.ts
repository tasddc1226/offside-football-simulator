// T-11-648 감독 커리어 3 화면 계산(웹 · 앱 공용): 이야기 문장, 진행 단계, 선수 · 후보 줄, 구간 라운드 범위.
// 문구는 i18n/ko/manager3(화면) · 게임 엔진 gManager(성향 · 목표 · 감독 커리어 2 이야기)를 쓴다.
import { managerEventResultText, managerEventText } from '@offside/game/manager';
import {
  M3_BLOCKS,
  M3_MIN_SEASONS,
  attrCap,
  type M3Event,
  type M3Player,
  type M3State,
} from '@offside/game/manager3';
import { fmtValue } from './format.js';
import { manager3Text as T } from './i18n/ko/manager3.js';

export type EventView = { title: string; body: string; choices: string[]; result: string | null };

const nameOf = (s: M3State, id: number | undefined) => s.squad.find((p) => p.id === id)?.name ?? '';

/** 이야기 한 건의 제목 · 본문 · 선택지 · (답했으면) 결과 문장. */
export function eventView(s: M3State, ev: M3Event): EventView {
  if (ev.kind === 'legacy') {
    const t = managerEventText(ev.id);
    return {
      title: t.t,
      body: t.b,
      choices: t.choices,
      result: ev.choice === null ? null : managerEventResultText(ev.id, ev.choice, ev.ok !== false),
    };
  }
  const name = nameOf(s, ev.player);
  const r = (i: number) => {
    if (ev.kind === 'playtime') return [T.ev_playtime_r0, T.ev_playtime_r1, T.ev_playtime_r2][i]!;
    if (ev.kind === 'renewal') return i === 0 ? T.ev_renewal_r0 : T.ev_renewal_r1;
    if (ev.kind === 'bigbid') return i === 0 ? T.ev_bigbid_r0 : T.ev_bigbid_r1;
    return i === 0 ? (ev.ok ? T.ev_fight_r0_ok : T.ev_fight_r0_fail) : T.ev_fight_r1;
  };
  const head = {
    playtime: {
      title: T.ev_playtime_t,
      body: T.ev_playtime_b({ name }),
      choices: [T.ev_playtime_c0, T.ev_playtime_c1, T.ev_playtime_c2],
    },
    renewal: {
      title: T.ev_renewal_t,
      body: T.ev_renewal_b({ name }),
      choices: [T.ev_renewal_c0, T.ev_renewal_c1],
    },
    bigbid: {
      title: T.ev_bigbid_t,
      body: T.ev_bigbid_b({ name, fee: fmtValue(ev.fee ?? 0) }),
      choices: [T.ev_bigbid_c0, T.ev_bigbid_c1],
    },
    fight: {
      title: T.ev_fight_t,
      body: T.ev_fight_b({ name, other: nameOf(s, ev.other) }),
      choices: [T.ev_fight_c0, T.ev_fight_c1],
    },
  }[ev.kind];
  return { ...head, result: ev.choice === null ? null : r(ev.choice) };
}

/** 시즌 진행 단계(제의 · 프리시즌 · 이적 · 시즌 · 결산)와 지금 위치. */
export function seasonSteps3(s: M3State) {
  const steps = [T.stepOffers, T.stepPreseason, T.stepWindow, T.stepBlocks, T.stepReview];
  const active =
    s.phase === 'offers'
      ? 0
      : s.phase === 'preseason'
        ? 1
        : s.phase === 'window' && s.window === 'summer'
          ? 2
          : s.phase === 'review' || s.phase === 'done'
            ? 4
            : 3;
  const progress = active === 3 ? (3 + s.block / M3_BLOCKS) / 5 : (active + 0.5) / 5;
  return { steps, active, progress };
}

/** 이번 구간이 치르는 리그 라운드(1부터). */
export function blockRounds(s: M3State) {
  const n = s.fixtures.length;
  return {
    from: Math.floor((s.block * n) / M3_BLOCKS) + 1,
    to: Math.floor(((s.block + 1) * n) / M3_BLOCKS),
  };
}

export const roleName = (p: Pick<M3Player, 'role'>) => T[`role_${p.role}`];

/** 선수 한 줄(역할 · 나이 · OVR). */
export const playerLine = (p: M3Player) =>
  T.playerMeta({ role: roleName(p), age: p.age, ovr: Math.round(p.ovr) });

/** 은퇴 버튼을 보일지 · 아직이면 남은 안내. */
export function retireInfo(s: M3State) {
  return s.season >= M3_MIN_SEASONS ? null : T.retireMinNote({ n: M3_MIN_SEASONS });
}

/** 성장 점수를 줄 수 있는 능력치(상한 아래). */
export const attrRoom = (s: M3State, k: keyof M3State['attrs']) => s.attrs[k] < attrCap(s.license);
