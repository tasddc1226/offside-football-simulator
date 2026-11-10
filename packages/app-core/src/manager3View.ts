// T-11-648 감독 커리어 3 화면 계산(웹 · 앱 공용): 이야기 문장, 진행 단계, 선수 · 후보 줄, 구간 라운드 범위.
// 문구는 i18n/ko/manager3(화면) · 게임 엔진 gManager(성향 · 목표 · 감독 커리어 2 이야기)를 쓴다.
import { managerEventResultText, managerEventText } from '@offside/game/manager';
import {
  M3_BLOCKS,
  M3_MIN_SEASONS,
  M3_ROLES,
  attrCap,
  storyOf,
  renewalEventWage,
  squadDisplayName,
  type M3Event,
  type M3Player,
  type M3State,
} from '@offside/game/manager3';
import { fmtValue } from './format.js';
import { manager3Text as T } from './i18n/ko/manager3.js';

/** detail: 본문 아래 숫자 한 줄(재계약 요구의 지금 · 제시 주급 등). 없으면 null. */
export type EventView = {
  title: string;
  body: string;
  detail: string | null;
  choices: string[];
  result: string | null;
};

const nameOf = (s: M3State, id: number | undefined) => {
  const n = s.squad.find((p) => p.id === id)?.name;
  return n ? squadDisplayName(n) : '';
};

/** 이야기 한 건의 제목 · 본문 · 선택지 · (답했으면) 결과 문장. */
export function eventView(s: M3State, ev: M3Event): EventView {
  if (ev.kind === 'legacy') {
    const t = managerEventText(ev.id);
    return {
      title: t.t,
      body: t.b,
      choices: t.choices,
      detail: null,
      result: ev.choice === null ? null : managerEventResultText(ev.id, ev.choice, ev.ok !== false),
    };
  }
  const name = nameOf(s, ev.player);
  if (ev.kind === 'story') {
    // 이야기 표 문구: st_<id>_t · _b · _c<i> · _r<i>(성공 확률이 있는 선택은 _r<i>_ok · _r<i>_fail).
    const tx = T as unknown as Record<
      string,
      string | ((p: { name: string; other: string }) => string)
    >;
    const str = (k: string) => {
      const v = tx[`st_${ev.id}_${k}`];
      return typeof v === 'function' ? v({ name, other: nameOf(s, ev.other) }) : (v ?? '');
    };
    const d = storyOf(ev.id);
    const n = d?.choices.length ?? 0;
    const i = ev.choice;
    return {
      title: str('t'),
      body: str('b'),
      detail: null,
      choices: Array.from({ length: n }, (_, k) => str(`c${k}`)),
      result:
        i === null
          ? null
          : d?.choices[i]?.p !== undefined
            ? str(`r${i}_${ev.ok ? 'ok' : 'fail'}`)
            : str(`r${i}`),
    };
  }
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
  }[ev.kind as 'playtime' | 'renewal' | 'bigbid' | 'fight'];
  const p = s.squad.find((x) => x.id === ev.player);
  // 재계약 요구: 답하기 전에는 지금 주급과 받아들일 때 주급을, 받아들인 뒤에는 새 주급을 보여 준다.
  const detail =
    ev.kind !== 'renewal' || !p
      ? null
      : ev.choice === null
        ? T.ev_renewal_wage({
            now: fmtValue(p.wage),
            next: fmtValue(renewalEventWage(p)),
            n: p.contract,
          })
        : ev.choice === 0
          ? T.ev_renewal_signed({ wage: fmtValue(p.wage) })
          : null;
  return { ...head, detail, result: ev.choice === null ? null : r(ev.choice) };
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

/** 선수단 탭 정렬 기준(T-11-689): 포지션 순 · OVR 높은 순 · 주급 높은 순. */
export const M3_SQUAD_SORTS = ['pos', 'ovr', 'wage'] as const;
export type M3SquadSort = (typeof M3_SQUAD_SORTS)[number];

/** 정렬한 사본. 포지션은 GK부터 ST까지, 같은 포지션 · 같은 값이면 OVR 높은 순. 원래 배열은 건드리지 않는다. */
export function sortSquad(squad: readonly M3Player[], by: M3SquadSort): M3Player[] {
  const role = (p: M3Player) => M3_ROLES.indexOf(p.role);
  return [...squad].sort((a, b) =>
    by === 'pos'
      ? role(a) - role(b) || b.ovr - a.ovr
      : by === 'ovr'
        ? b.ovr - a.ovr || role(a) - role(b)
        : b.wage - a.wage || b.ovr - a.ovr,
  );
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
