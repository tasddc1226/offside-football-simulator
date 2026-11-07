// ───────── T-11-669 은퇴 화면 실험 계측(웹 GA4 · 앱 Firebase 공용) ─────────
// 이용 분석에 동의한 사람만 기록 · 전송한다(io.allowed). 이름 · 선수명 · 원래 프로필 ID는 보내지 않는다.
// 결과(다음 유효 플레이 · 첫 팀 저장 · 첫 구단 경기)는 화면 클릭이 아니라 실제 완료 경계에서만 남긴다:
// next_play는 리그 반기 구간을 경기 1번 이상 치르고 끝낸 때(player-metrics play_complete와 같은 조건),
// team_save · club_match는 서버가 저장 · 경기 결과를 돌려준 때(api/team → clubSignals).
import type { Progress } from './player-metrics.js';
import {
  RETIRE_EXP_ID,
  type RetireArm,
  type RetireCta,
  type RetireSceneKind,
} from './retireExperiment.js';

export const RETIRE_EXP_STORE = 'offside_retire_exp_v1';
/** 노출 뒤 이 시간 안의 결과만 그 노출에 묶는다. */
export const RETIRE_EXP_WINDOW_MS = 7 * 86_400_000;
export type RetireOutcome = 'next_play' | 'team_save' | 'club_match';
export type RetireOrder = 'first' | 'repeat';
type Params = Record<string, string | number | boolean>;

type Current = {
  arm: RetireArm;
  cid: string;
  order: RetireOrder;
  at: number;
  pk: string;
  done: RetireOutcome[];
};
type Store = { v: 1; seen: string[]; cur?: Current };

const ARMS: readonly string[] = ['treatment', 'control'];
const OUTCOMES: readonly string[] = ['next_play', 'team_save', 'club_match'];

export function parseRetireExpStore(raw: string | null): Store {
  try {
    const s = JSON.parse(raw ?? 'null') as Store;
    if (s?.v !== 1 || !Array.isArray(s.seen) || !s.seen.every((x) => typeof x === 'string'))
      return { v: 1, seen: [] };
    const c = s.cur;
    if (
      c &&
      (!ARMS.includes(c.arm) ||
        typeof c.cid !== 'string' ||
        (c.order !== 'first' && c.order !== 'repeat') ||
        !Number.isFinite(c.at) ||
        typeof c.pk !== 'string' ||
        !Array.isArray(c.done) ||
        !c.done.every((o) => OUTCOMES.includes(o)))
    )
      return { v: 1, seen: s.seen.slice(-20) };
    return { v: 1, seen: s.seen.slice(-20), ...(c ? { cur: c } : {}) };
  } catch {
    return { v: 1, seen: [] };
  }
}

/** 노출부터 결과까지 걸린 시간 구간(정확한 시각은 보내지 않는다). */
export function elapsedBucket(ms: number): 'lt1h' | '1h_24h' | '1d_7d' {
  if (ms < 3_600_000) return 'lt1h';
  if (ms < 86_400_000) return '1h_24h';
  return '1d_7d';
}

/** 은퇴 화면에 머문 시간 구간. 즉시 이탈 = lt10 · interacted=false(설계 문서). */
export function dwellBucket(ms: number): 'lt10' | '10_60' | 'gt60' {
  if (ms < 10_000) return 'lt10';
  if (ms < 60_000) return '10_60';
  return 'gt60';
}

/** 화면 준비 시간(ms, 0~60000으로 자르고 정수). p95는 GA4 · BigQuery에서 군별로 계산한다. */
export const readyMs = (ms: number): number =>
  Math.max(0, Math.min(60_000, Math.round(Number.isFinite(ms) ? ms : 0)));

/** 계정 상태 키: 문자열 = 그 계정, null = 계정 없음(로그아웃 · 삭제 · 세션 없음), undefined = 아직 모름(확인 중 · 연결 실패). */
export type AccountKey = string | null | undefined;

export type RetireExposure = {
  arm: RetireArm;
  cid: string;
  order: RetireOrder;
  upload: string;
  account: string;
  scenes: number;
  readyMs: number;
  /** 노출 당시 계정 키(retireExperiment profileKey). 군은 프로필 ID로 정하므로 늘 있다. */
  pk: string;
};

export function createRetireExpMetrics(io: {
  allowed(): boolean;
  read(): string | null;
  write(raw: string): void;
  send(name: string, params: Params): void;
  now(): number;
  /** 지금 계정 키. 결과를 묻을 때마다 읽어 노출 때 계정과 엄격히 같을 때만 귀속한다. */
  account(): AccountKey;
}) {
  const base = (arm: RetireArm): Params => ({ exp_id: RETIRE_EXP_ID, arm });
  const send = (name: string, params: Params) => {
    try {
      if (io.allowed()) io.send(name, params);
    } catch {
      /* optional */
    }
  };
  function update(fn: (s: Store) => Store | null): void {
    try {
      if (!io.allowed()) return;
      const next = fn(parseRetireExpStore(io.read()));
      if (next) io.write(JSON.stringify(next));
    } catch {
      /* optional */
    }
  }
  /** 계정이 다르면(로그아웃 · 다른 계정 · 삭제) 이전 노출의 귀속을 지운다. 모르면 그대로 둔다. */
  const differs = (c: Current, now: AccountKey) => now !== undefined && now !== c.pk;
  function outcome(kind: RetireOutcome, requestKey: AccountKey, cid?: string): void {
    update((s) => {
      const c = s.cur;
      if (!c) return null;
      const now = io.account();
      const elapsed = io.now() - c.at;
      // 기한이 지났거나 계정이 바뀌었으면 묶지 않고 지운다(되돌려 보내지 않는다).
      if (elapsed < 0 || elapsed > RETIRE_EXP_WINDOW_MS || differs(c, now))
        return { v: 1, seen: s.seen };
      // 노출 때 계정과 지금 계정(구단 결과는 요청 당시 계정까지)이 같다고 확인되기 전에는 귀속하지 않는다.
      if (now !== c.pk || requestKey !== c.pk) return null;
      if (c.done.includes(kind)) return null;
      // 방금 은퇴한 그 커리어의 기록은 '다음' 플레이가 아니다.
      if (kind === 'next_play' && cid === c.cid) return null;
      c.done.push(kind);
      send('retire_exp_outcome', {
        ...base(c.arm),
        outcome: kind,
        retire_order: c.order,
        elapsed: elapsedBucket(elapsed),
      });
      return s;
    });
  }

  // 지금 보고 있는 은퇴 화면 하나. 노출이 실제로 나간(또는 이미 나갔던) 뒤에만 장면 · 다음 행동 · 떠남을 보낸다.
  // 동의 · SDK가 늦게 준비되면 ready()에서 노출을 보내고, 그 전에 누른 것은 되돌려 보내지 않는다.
  let view: { x: RetireExposure; exposed: boolean } | null = null;
  function tryExpose(): void {
    const v = view;
    if (!v || v.exposed || !io.allowed()) return;
    update((s) => {
      if (s.seen.includes(v.x.cid)) {
        // 같은 커리어 화면을 다시 연 것: 노출은 한 번만 세고 상호작용은 받는다.
        v.exposed = true;
        return null;
      }
      const x = v.x;
      s.seen = [...s.seen, x.cid].slice(-20);
      s.cur = { arm: x.arm, cid: x.cid, order: x.order, at: io.now(), pk: x.pk, done: [] };
      send('retire_exp_exposure', {
        ...base(x.arm),
        retire_order: x.order,
        upload_state: x.upload,
        account_state: x.account,
        scene_count: x.scenes,
        ready_ms: readyMs(x.readyMs),
      });
      v.exposed = true;
      return s;
    });
  }
  const live = (arm: RetireArm) => !!view && view.exposed && view.x.arm === arm;
  return {
    /** 은퇴 화면에서 군이 정해졌을 때. 같은 커리어는 한 번만 센다(대조군도 같은 이름 · 같은 필드 = 같은 분모). */
    view(x: RetireExposure): void {
      view = { x, exposed: false };
      tryExpose();
    },
    /** 이용 분석이 준비됐을 때(동의 · 태그 · SDK). 보고 있는 화면의 노출을 이때 보낸다. */
    ready(): void {
      tryExpose();
    },
    /** 화면을 떠났다. 노출이 나갔으면 떠남을 보낸다. nav면 화면을 닫고, hide(앱 · 탭 가림)는 돌아와 누를 수 있게 둔다. */
    leave(arm: RetireArm, x: { dwellMs: number; interacted: boolean; via: 'nav' | 'hide' }) {
      if (live(arm))
        send('retire_exp_leave', {
          ...base(arm),
          dwell: dwellBucket(x.dwellMs),
          interacted: x.interacted ? 1 : 0,
          via: x.via,
        });
      if (x.via === 'nav') view = null;
    },
    /** 화면이 사라졌다(노출 전이어도). 보류한 노출을 버린다. */
    end(): void {
      view = null;
    },
    exposed: (arm: RetireArm) => live(arm),
    scene(arm: RetireArm, scene: RetireSceneKind) {
      if (live(arm)) send('retire_exp_scene_open', { ...base(arm), scene });
    },
    /** 대조군의 기존 '내 구단 만들기'는 cta=legacy_club으로 같은 이름에 남긴다. */
    cta(arm: RetireArm, cta: RetireCta | 'legacy_club') {
      if (live(arm)) send('retire_exp_cta_click', { ...base(arm), cta });
    },
    error(arm: RetireArm, stage: 'scenes' | 'next_step') {
      send('retire_exp_error', { ...base(arm), stage });
    },
    complete(p: Progress) {
      if (p.matches <= 0 || p.phase < 1 || p.phase > 2) return;
      // 개인 커리어 진행은 요청이 없어 지금 계정이 곧 요청 당시 계정이다.
      outcome('next_play', io.account(), p.cid);
    },
    /** 서버 성공 신호. requestKey는 그 요청을 보낼 때의 계정 키(clubSignals가 넘긴다). */
    club(kind: 'team_save' | 'club_match', requestKey: AccountKey) {
      outcome(kind, requestKey);
    },
    /** 계정 확인 결과가 바뀌었을 때(로그인 · 로그아웃 · 삭제 · 다른 계정). 다르면 이전 귀속을 지운다. */
    account(now: AccountKey) {
      if (now === undefined) return;
      update((s) => (s.cur && differs(s.cur, now) ? { v: 1, seen: s.seen } : null));
    },
  };
}
export type RetireExpMetrics = ReturnType<typeof createRetireExpMetrics>;
